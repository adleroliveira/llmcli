#!/usr/bin/env node
import { Command } from "commander";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { configManager } from "./ConfigManager.js";
import { BedrockCLI } from "./BedrockCLI.js";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
// Tools
import { createDisplayDirectoryTool, createFileListTool, } from "./tools/DirectoryListing.js";
import { createFileReadTool, createFileWriteTool, } from "./tools/FileReading.js";
import { createCommandExecutionTool } from "./tools/CommandExecution.js";
import { createBackgroundCommandTool } from "./tools/BackgroundExecution.js";
import { createSystemInfoTool } from "./tools/SystemInformation.js";
import { processManager } from "./BackgroundProcessManager.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let currentCLI = null;
// Graceful shutdown handler
const handleShutdown = async (signal) => {
    console.log(chalk.yellow(`\n\nReceived ${signal}. Shutting down gracefully...`));
    if (currentCLI) {
        await currentCLI.cleanup();
    }
    await processManager.cleanup(8000, true);
    process.exit(0);
};
// Register shutdown handlers
process.on("SIGINT", () => handleShutdown("SIGINT")); // Ctrl+C
process.on("SIGTERM", () => handleShutdown("SIGTERM")); // Kill command
process.on("SIGQUIT", () => handleShutdown("SIGQUIT")); // Ctrl+\
// Handle uncaught errors
process.on("uncaughtException", (error) => {
    console.error(chalk.red("\nAn unexpected error occurred:"));
    console.error(error);
    process.exit(1);
});
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
    console.error(chalk.red("\nAn unhandled promise rejection occurred:"));
    console.error(reason);
    process.exit(1);
});
// Read package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
const program = new Command();
program
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .addHelpText("after", chalk.cyan(`
    Detailed Usage Guide:
    ===================
    
    Configuration:
      Initial setup:    ${chalk.bold(`${program.name()} configure`)}
      Update settings:  ${chalk.bold(`${program.name()} config`)}
      Reset everything: ${chalk.bold(`${program.name()} cleanup`)}
    
    Command Options:
      cleanup:
        -f, --force    Skip confirmation prompt during cleanup
    
    Examples:
      # Start the CLI with default settings
      $ ${program.name()}
    
      # Configure AWS credentials
      $ ${program.name()} configure
    
      # Force cleanup without confirmation
      $ ${program.name()} cleanup --force
    
    Additional Information:
    - AWS credentials are required for using this CLI
    - The CLI validates credentials and Bedrock model access on startup
    - Use Ctrl+C to exit the CLI at any time
    
    ${chalk.gray("Version: " + packageJson.version)}
    `));
async function validateCredentialsAndAccess() {
    const credSpinner = ora("Validating AWS credentials...").start();
    try {
        const hasValidCreds = await configManager.hasValidCredentials();
        if (!hasValidCreds) {
            credSpinner.fail("Invalid or missing AWS credentials");
            console.log(chalk.cyan(`\nTip: You can run ${chalk.bold(`${program.name()} configure`)} or ${chalk.bold(`${program.name()} config`)} to set up your AWS credentials.`));
            const { shouldReconfigure } = await inquirer.prompt([
                {
                    type: "list",
                    name: "shouldReconfigure",
                    message: "How would you like to proceed?",
                    choices: [
                        { name: "Configure credentials now", value: "configure" },
                        { name: "Exit", value: "exit" },
                    ],
                },
            ]);
            if (shouldReconfigure === "configure") {
                const configSpinner = ora("Setting up configuration...").start();
                await configManager.setupInitialConfig();
                configSpinner.succeed("Configuration completed");
                return await configManager.hasValidAccessAndCredentials();
            }
            else {
                console.log(chalk.yellow("\nExiting..."));
                process.exit(0);
            }
        }
        credSpinner.succeed("AWS credentials validated");
        // Check Bedrock access
        const accessSpinner = ora("Validating Bedrock model access...").start();
        const hasValidAccess = await configManager.hasValidBedrockAccess();
        if (!hasValidAccess) {
            accessSpinner.fail("Lost access to Bedrock model or invalid configuration");
            console.log(chalk.cyan(`\nTip: You may need to reconfigure access to the Bedrock model. Run ${chalk.bold(`${program.name()} configure`)} to set up again.`));
            const { shouldReconfigure } = await inquirer.prompt([
                {
                    type: "list",
                    name: "shouldReconfigure",
                    message: "How would you like to proceed?",
                    choices: [
                        { name: "Reconfigure now", value: "configure" },
                        { name: "Exit", value: "exit" },
                    ],
                },
            ]);
            if (shouldReconfigure === "configure") {
                const configSpinner = ora("Reconfiguring access...").start();
                await configManager.setupInitialConfig();
                configSpinner.succeed("Access reconfigured");
                return await configManager.hasValidAccessAndCredentials();
            }
            else {
                console.log(chalk.yellow("\nExiting..."));
                process.exit(0);
            }
        }
        accessSpinner.succeed("Bedrock model access validated");
        return true;
    }
    catch (error) {
        credSpinner.fail("Validation failed");
        throw error;
    }
}
// Default action when no command is provided
program
    .command("start", { isDefault: true })
    .description("Start the CLI interface")
    .action(async () => {
    try {
        // Your existing default action code here
        const spinner = ora("Checking configuration...").start();
        if (!configManager.hasValidConfig()) {
            spinner.info("No configuration found");
            console.log(chalk.cyan(`Use ${chalk.bold(`${program.name()} configure`)} to set up your AWS credentials.`));
            await configManager.setupInitialConfig();
        }
        else {
            spinner.succeed("Configuration found");
        }
        const credentialsValid = await validateCredentialsAndAccess();
        if (credentialsValid) {
            console.log(chalk.gray(`\nTip: You can update your configuration anytime using ${chalk.bold(`${program.name()} configure`)}`));
            const config = configManager.getConfig();
            const cli = await BedrockCLI.create({
                modelId: config.bedrock.modelId,
                region: config.awsRegion,
                systemPrompt: [
                    {
                        text: `You are Sage, a knowledgeable and efficient CLI assistant focused on helping users be more productive. Your responses are:
          - Clear and concise, favoring brevity while remaining informative
          - Terminal-friendly, using clear formatting that works well in CLI
          - Direct and actionable, providing specific commands or solutions when applicable
          - Context-aware, remembering previous interactions within the session
          
          When appropriate:
          - Suggest relevant tools the user has available
          - Provide example commands or usage patterns
          - Break down complex tasks into manageable steps
          - Offer improvements or best practices
          
          If you're unsure about something, acknowledge it and suggest alternatives or ask for clarification. When using tools, explain what you're doing briefly.
          Remember: You're a CLI assistant - embrace the command-line context in your communication style.`,
                    },
                ],
                tools: [
                    createDisplayDirectoryTool(),
                    createFileListTool(),
                    createFileReadTool(),
                    createFileWriteTool(),
                    createCommandExecutionTool(),
                    createBackgroundCommandTool(),
                    createSystemInfoTool(),
                ],
                credentials: configManager.getCredentials(),
                assistantName: "Sage",
            });
            currentCLI = cli;
            await cli.start();
        }
    }
    catch (error) {
        console.error(chalk.red("\nAn error occurred:"));
        console.error(error);
        process.exit(1);
    }
});
program
    .command("configure")
    .alias("config")
    .description("Configure AWS credentials and settings")
    .action(async () => {
    try {
        await configManager.setupInitialConfig();
        const spinner = ora("Validating new configuration...").start();
        const credentialsValid = await configManager.hasValidCredentials();
        if (credentialsValid) {
            spinner.succeed("Configuration completed successfully! ✅");
        }
        else {
            spinner.fail("Failed to validate new configuration");
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk.red("\nAn error occurred during configuration:"));
        console.error(error);
        process.exit(1);
    }
});
program
    .command("cleanup")
    .description("Remove all saved configurations, credentials, and cached data")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async (options) => {
    try {
        const spinner = ora("Cleaning up configurations and cached data...");
        // Let ConfigManager handle the confirmation
        await configManager.cleanup({ force: options.force });
        // Only show the success spinner if cleanup wasn't cancelled
        spinner.succeed("Cleanup completed successfully");
    }
    catch (error) {
        console.error(chalk.red("\nAn error occurred during cleanup:"));
        console.error(error);
        process.exit(1);
    }
});
program.parse();
