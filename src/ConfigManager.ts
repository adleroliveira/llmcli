import { join } from "path";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fromEnv, fromIni } from "@aws-sdk/credential-providers";
import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { BedrockManager } from "./BedrockManager.js";
import chalk from "chalk";
import inquirer from "inquirer";
import { readdirSync, unlinkSync } from "fs";

// Constants for configuration
const CONFIG_DIR = join(homedir(), ".llmcli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const CREDENTIALS_FILE = join(CONFIG_DIR, "credentials.json");
const CACHE_DIR = join(CONFIG_DIR, "cache");

interface BedrockConfig {
  modelId: string;
}

export interface CliConfig {
  awsProfile?: string;
  awsRegion?: string;
  bedrock?: BedrockConfig;
  authMethod?: "stored" | "environment" | "profile";
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

type CredentialSource = "stored" | "environment" | "profile";

class ConfigManager {
  private config: CliConfig = {};
  private runtimeCredentials?: AwsCredentials;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    // Create config directory if it doesn't exist
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR);
      mkdirSync(CACHE_DIR);
    }

    // Load existing config if it exists
    if (existsSync(CONFIG_FILE)) {
      try {
        this.config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
      } catch (error) {
        console.error(chalk.red("Error reading config file. Using defaults."));
      }
    }

    // Load stored credentials if they exist
    if (existsSync(CREDENTIALS_FILE)) {
      try {
        this.runtimeCredentials = JSON.parse(
          readFileSync(CREDENTIALS_FILE, "utf8")
        );
      } catch (error) {
        console.error(chalk.red("Error loading stored credentials."));
      }
    }
  }

  private saveConfig() {
    writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  private async validateCredentials(
    credentials: AwsCredentials
  ): Promise<boolean> {
    try {
      const stsClient = new STSClient({
        credentials: credentials,
        region: this.config.awsRegion || "us-east-1",
      });

      await stsClient.send(new GetCallerIdentityCommand({}));
      return true;
    } catch (error) {
      console.error(chalk.red("Invalid AWS credentials"));
      return false;
    }
  }

  private async loadAndValidateCredentials(
    source: CredentialSource
  ): Promise<AwsCredentials | undefined> {
    try {
      let credentials: AwsCredentials | undefined;

      switch (source) {
        case "environment":
          const envCreds = await fromEnv()();
          credentials = {
            accessKeyId: envCreds.accessKeyId,
            secretAccessKey: envCreds.secretAccessKey,
            sessionToken: envCreds.sessionToken,
          };
          break;

        case "profile":
          const profileCreds = await fromIni({
            profile: this.config.awsProfile,
          })();
          credentials = {
            accessKeyId: profileCreds.accessKeyId,
            secretAccessKey: profileCreds.secretAccessKey,
            sessionToken: profileCreds.sessionToken,
          };
          break;

        case "stored":
          if (existsSync(CREDENTIALS_FILE)) {
            credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf8"));
          }
          break;
      }

      if (credentials && (await this.validateCredentials(credentials))) {
        return credentials;
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async getAvailableProfiles(): Promise<string[]> {
    try {
      const { configFile, credentialsFile } = await loadSharedConfigFiles();
      const profiles = new Set<string>();

      if (configFile) {
        Object.keys(configFile).forEach((profile) => profiles.add(profile));
      }
      if (credentialsFile) {
        Object.keys(credentialsFile).forEach((profile) =>
          profiles.add(profile)
        );
      }

      return Array.from(profiles);
    } catch (error) {
      console.error(chalk.yellow("Unable to load AWS profiles"));
      return ["default"];
    }
  }

  private async promptForManualCredentials(): Promise<AwsCredentials> {
    console.log(chalk.yellow("\nPlease enter your AWS credentials:"));
    console.log(
      chalk.red("⚠️  Warning: Handle these credentials with care!\n")
    );

    const credentials = await inquirer.prompt([
      {
        type: "input",
        name: "accessKeyId",
        message: "AWS Access Key ID:",
        validate: (input) => input.length > 0,
      },
      {
        type: "password",
        name: "secretAccessKey",
        message: "AWS Secret Access Key:",
        validate: (input) => input.length > 0,
      },
      {
        type: "password",
        name: "sessionToken",
        message: "AWS Session Token (optional):",
      },
    ]);

    return credentials;
  }

  private async promptForCredentialStorage(
    credentials: AwsCredentials
  ): Promise<boolean> {
    console.log(chalk.red("\n⚠️  Security Warning:"));
    console.log(
      chalk.yellow(
        "Storing AWS credentials in config files is not recommended for security reasons.\n" +
          "Instead, consider using the AWS CLI to manage your credentials securely.\n" +
          "If you choose to save credentials here, they will be stored in plaintext.\n"
      )
    );

    const { shouldStore } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldStore",
        message:
          "Do you still want to save these credentials to the config file?",
        default: false,
      },
    ]);

    return shouldStore;
  }

  async detectAwsCredentials(): Promise<CredentialSource[]> {
    const availableMethods: CredentialSource[] = [];

    // Check for stored manual credentials first
    if (existsSync(CREDENTIALS_FILE)) {
      try {
        const storedCreds = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf8"));
        if (
          storedCreds.accessKeyId &&
          storedCreds.secretAccessKey &&
          (await this.validateCredentials(storedCreds)) // Add validation here
        ) {
          availableMethods.push("stored");
        }
      } catch (error) {
        // Ignore errors when stored credentials are invalid
      }
    }

    // Try loading from environment
    try {
      const envCreds = await fromEnv()();
      if (envCreds.accessKeyId) {
        availableMethods.push("environment");
      }
    } catch (error) {
      // Ignore errors when env vars aren't available
    }

    // Try loading from AWS profile
    try {
      const iniCreds = await fromIni()();
      if (iniCreds.accessKeyId) {
        availableMethods.push("profile");
      }
    } catch (error) {
      // Ignore errors when credentials file doesn't exist
    }

    return availableMethods;
  }

  async setupInitialConfig(): Promise<void> {
    console.log(chalk.blue("Welcome to LLMCLI! 👋\n"));
    console.log(
      chalk.yellow("Let's get you set up with AWS credentials first.")
    );

    const availableMethods = await this.detectAwsCredentials();
    let useExisting = false;

    if (availableMethods.length > 0) {
      console.log(chalk.green("\nI found existing AWS credentials:"));
      availableMethods.forEach((method) => {
        console.log(
          `- ${
            method === "environment"
              ? "Environment variables"
              : method === "profile"
              ? "AWS profile"
              : "Stored credentials"
          }`
        );
      });

      const response = await inquirer.prompt([
        {
          type: "confirm",
          name: "useExisting",
          message: "Would you like to use these existing credentials?",
          default: true,
        },
      ]);

      useExisting = response.useExisting;

      if (useExisting) {
        let selectedMethod: CredentialSource = availableMethods[0];

        if (availableMethods.length > 1) {
          const { method } = await inquirer.prompt([
            {
              type: "list",
              name: "method",
              message: "Which credentials would you like to use?",
              choices: availableMethods.map((method) => ({
                name:
                  method === "environment"
                    ? "Environment variables"
                    : method === "profile"
                    ? "AWS profile"
                    : "Stored credentials",
                value: method,
              })),
            },
          ]);
          selectedMethod = method;
        }

        if (selectedMethod === "profile") {
          const profiles = await this.getAvailableProfiles();
          const { profile } = await inquirer.prompt([
            {
              type: "list",
              name: "profile",
              message: "Which AWS profile would you like to use?",
              choices: profiles,
              default: "default",
            },
          ]);
          this.config.awsProfile = profile;
        }

        // Validate selected credentials
        const validatedCreds = await this.loadAndValidateCredentials(
          selectedMethod
        );
        if (!validatedCreds) {
          console.log(
            chalk.red(
              "\nSelected credentials are invalid. Please provide new credentials."
            )
          );
          useExisting = false;
        } else {
          this.runtimeCredentials = validatedCreds;
        }
      }
    }

    if (!availableMethods.length || !useExisting) {
      console.log(chalk.yellow("\nPlease provide your AWS credentials:"));

      const { credentialType } = await inquirer.prompt([
        {
          type: "list",
          name: "credentialType",
          message: "How would you like to configure AWS credentials?",
          choices: [
            { name: "Use AWS CLI (recommended)", value: "awscli" },
            { name: "Enter credentials manually", value: "manual" },
          ],
        },
      ]);

      if (credentialType === "awscli") {
        console.log(
          chalk.green(
            '\nPlease run "aws configure" to set up your credentials.'
          )
        );
        console.log("Once completed, run this setup again.");
        process.exit(0);
      } else {
        const credentials = await this.promptForManualCredentials();

        // Validate manually entered credentials
        const isValid = await this.validateCredentials(credentials);
        if (!isValid) {
          console.log(
            chalk.red("\nProvided credentials are invalid. Please try again.")
          );
          process.exit(1);
        }

        // Store in runtime memory
        this.runtimeCredentials = credentials;

        // Ask if user wants to save to config
        const shouldStore = await this.promptForCredentialStorage(credentials);

        if (shouldStore) {
          writeFileSync(
            CREDENTIALS_FILE,
            JSON.stringify(credentials, null, 2),
            { mode: 0o600 }
          );

          this.config.authMethod = "stored";

          console.log(
            chalk.yellow(
              "\nCredentials saved. Please ensure the config directory permissions are secure."
            )
          );
        } else {
          console.log(
            chalk.green(
              "\nCredentials will be stored in memory only for this session."
            )
          );
        }
      }
    }

    const { region } = await inquirer.prompt([
      {
        type: "input",
        name: "region",
        message:
          "Which AWS region would you like to use? (Recommended: us-west-2)",
        default: "us-west-2",
      },
    ]);

    this.config.awsRegion = region;

    const bedrockManager = new BedrockManager(
      this.config,
      this.runtimeCredentials!
    );
    await bedrockManager.setupBedrockConfig();

    this.saveConfig();

    console.log(chalk.green("\nConfiguration completed successfully! 🎉"));
    console.log(`Configuration saved to: ${CONFIG_FILE}`);
  }

  async getCredentials(): Promise<AwsCredentials> {
    // Ensure credentials are loaded before returning them
    await this.loadCredentials();

    if (!this.runtimeCredentials) {
      throw new Error("No valid AWS credentials found");
    }

    return this.runtimeCredentials;
  }

  getConfig(): CliConfig {
    return this.config;
  }

  async loadCredentials(): Promise<void> {
    // First check if current runtime credentials are valid
    if (
      this.runtimeCredentials?.accessKeyId &&
      this.runtimeCredentials?.secretAccessKey
    ) {
      const isValid = await this.validateCredentials(this.runtimeCredentials);
      if (isValid) return;
    }

    // If we have a configured auth method, try that first
    if (this.config.authMethod) {
      const credentials = await this.loadAndValidateCredentials(
        this.config.authMethod
      );
      if (credentials) {
        this.runtimeCredentials = credentials;
        return;
      }
    }

    // Only try other methods if no auth method is configured
    if (!this.config.authMethod) {
      const methods: Array<"stored" | "environment" | "profile"> = [
        "stored",
        "profile",
        "environment",
      ];

      for (const method of methods) {
        const credentials = await this.loadAndValidateCredentials(method);
        if (credentials) {
          this.runtimeCredentials = credentials;
          return;
        }
      }
    }
  }

  async hasValidCredentials(): Promise<boolean> {
    try {
      await this.loadCredentials();
      return !!this.runtimeCredentials;
    } catch (error) {
      return false;
    }
  }

  hasValidConfig(): boolean {
    if (!existsSync(CONFIG_FILE)) {
      return false;
    }

    try {
      const config = this.getConfig();
      return !!(
        // Check for any of the valid auth methods
        (
          (config.awsProfile ||
            process.env.AWS_ACCESS_KEY_ID ||
            config.authMethod === "stored") &&
          // Still require region
          !!config.awsRegion
        )
      );
    } catch {
      return false;
    }
  }

  async cleanup(options: { force?: boolean } = {}): Promise<void> {
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: chalk.yellow(
            "⚠️  This will delete all saved configurations, credentials, and cached data. Are you sure?"
          ),
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray("Cleanup cancelled."));
        return;
      }
    }

    try {
      // Clear runtime credentials
      this.runtimeCredentials = undefined;
      this.config = {};

      // Remove config file
      if (existsSync(CONFIG_FILE)) {
        writeFileSync(CONFIG_FILE, "{}");
      }

      // Remove credentials file
      if (existsSync(CREDENTIALS_FILE)) {
        writeFileSync(CREDENTIALS_FILE, "{}");
      }

      // Clear cache directory
      if (existsSync(CACHE_DIR)) {
        // Remove all files in cache directory
        const files = readdirSync(CACHE_DIR);
        for (const file of files) {
          unlinkSync(join(CACHE_DIR, file));
        }
      }
    } catch (error) {
      console.error(chalk.red("Error during cleanup:"));
      console.error(error);
      throw error;
    }
  }

  async hasValidBedrockAccess(): Promise<boolean> {
    if (!this.config.bedrock?.modelId) {
      return false;
    }

    try {
      const bedrockManager = new BedrockManager(
        this.config,
        this.runtimeCredentials!
      );
      return await bedrockManager.validateModelAccess();
    } catch (error) {
      console.error("Error validating Bedrock access:", error);
      return false;
    }
  }

  async hasValidAccessAndCredentials(): Promise<boolean> {
    const hasValidCreds = await this.hasValidCredentials();
    if (!hasValidCreds) {
      return false;
    }

    return await this.hasValidBedrockAccess();
  }
}

export const configManager = new ConfigManager();
