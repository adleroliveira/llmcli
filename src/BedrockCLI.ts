import readline from "readline";
import chalk from "chalk";
import { BedrockAgent, Tool } from "./BedrockAgent.js";
import { SystemContentBlock } from "@aws-sdk/client-bedrock-runtime";
import { AwsCredentials } from "./ConfigManager";
import { processManager } from "./BackgroundProcessManager.js";

interface BedrockCLIConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  region?: string;
  systemPrompt?: SystemContentBlock[];
  sessionId?: string;
  tools?: Tool[];
  credentials: AwsCredentials;
}

class BedrockCLI {
  private agent: BedrockAgent;
  private rl: readline.Interface | null = null;
  private sessionId: string;
  private isFirstChunk: boolean = true;
  private systemPrompt: SystemContentBlock[];
  private tools: Map<string, Tool>;
  private isRunning: boolean = false;
  private cleanupPromise: Promise<void> | null = null;
  private goodbyeShown: boolean = false;

  constructor(config: BedrockCLIConfig) {
    this.agent = new BedrockAgent({
      modelId: config.modelId,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      topP: config.topP,
      stopSequences: config.stopSequences,
      region: config.region,
      credentials: config.credentials,
    });

    config.tools?.forEach((tool) => {
      this.agent.registerTool(tool);
    });

    this.systemPrompt = config.systemPrompt || [
      { text: "You are a helpful assistant." },
    ];
    this.sessionId = config.sessionId || "cli-session";
    this.tools = new Map();

    if (config.tools) {
      for (const tool of config.tools) {
        const toolSpec = tool.spec();
        this.tools.set(toolSpec.toolSpec.name, tool);
      }
    }
  }

  private displayWelcomeMessage() {
    console.log(chalk.cyan.bold("\n🤖 Welcome to LLMCLI!\n"));
    console.log(
      chalk.gray(
        `• Type ${chalk.white.bold("exit")} or ${chalk.white.bold(
          "quit"
        )} to end the session`
      )
    );
    console.log(
      chalk.gray(`• Type ${chalk.white.bold("tools")} to see available tools\n`)
    );
  }

  private createReadlineInterface(): readline.Interface {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.bold.blue("You: "),
      terminal: true,
    });

    // Ensure proper handling of Ctrl+C
    rl.on("SIGINT", () => {
      console.log("\nExiting...");
      rl.close();
      process.exit(0);
    });

    return rl;
  }

  private async performCleanup(forceKill: boolean = false): Promise<void> {
    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }

    this.cleanupPromise = (async () => {
      if (!this.goodbyeShown) {
        console.log(chalk.yellow("\nCleaning up background processes..."));
        await processManager.cleanup(5000, forceKill);
        this.isRunning = false;
        if (this.rl) {
          this.rl.removeAllListeners("close");
          this.rl.close();
          this.rl = null;
        }
        console.log(chalk.yellow("\nGoodbye! 👋"));
        this.goodbyeShown = true;
      }
    })();

    return this.cleanupPromise;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("CLI is already running");
    }
    this.isRunning = true;
    this.goodbyeShown = false;

    return new Promise((resolve) => {
      console.log(chalk.gray("Initializing conversation..."));

      const cleanup = async (forceKill: boolean = false) => {
        await this.performCleanup(forceKill);
        resolve();
      };

      // Initialize conversation
      this.agent
        .createConversation(this.sessionId, {
          systemPrompt: this.systemPrompt,
          onMessage: (chunk) => {
            if (this.isFirstChunk) {
              process.stdout.write(chalk.green.bold("\nAssistant: "));
              this.isFirstChunk = false;
            }
            process.stdout.write(chalk.green(chunk));
          },
          onComplete: () => {
            this.isFirstChunk = true;
            process.stdout.write("\n\n");
            if (this.isRunning && this.rl) {
              this.rl.prompt();
            }
          },
          onError: (error) => {
            console.error(chalk.red("\n❌ Error:"), error);
            this.isFirstChunk = true;
            if (this.isRunning && this.rl) {
              this.rl.prompt();
            }
          },
        })
        .then(() => {
          // Initialize readline after conversation is ready
          this.rl = this.createReadlineInterface();

          // Handle input
          this.rl.on("line", async (line) => {
            const trimmedLine = line.trim();

            if (!trimmedLine) {
              this.rl?.prompt();
              return;
            }

            if (
              trimmedLine.toLowerCase() === "exit" ||
              trimmedLine.toLowerCase() === "quit"
            ) {
              await cleanup(true);
              return;
            }

            if (trimmedLine.toLowerCase() === "tools") {
              console.log(chalk.yellow.bold("\n🔧 Available Tools:"));
              for (const [name, tool] of this.tools.entries()) {
                const spec = tool.spec().toolSpec;
                console.log(chalk.yellow(`\n${name}:`));
                console.log(chalk.gray(`  Description: ${spec.description}`));
                console.log(chalk.gray("  Input Schema:"));
                console.log(
                  chalk.gray(JSON.stringify(spec.inputSchema.json, null, 2))
                );
              }
              console.log("");
              this.rl?.prompt();
              return;
            }

            console.log(chalk.gray("\nSending message..."));
            try {
              await this.agent.sendMessage(this.sessionId, trimmedLine);
            } catch (error) {
              console.error(chalk.red("\nFailed to send message"));
              console.error(chalk.red("Error details:"), error);
              this.rl?.prompt();
            }
          });

          this.rl.on("close", async () => {
            await cleanup();
          });
          this.displayWelcomeMessage();
          this.rl.prompt();
        })
        .catch(async (error) => {
          console.error("Failed to initialize conversation:", error);
          await cleanup();
        });
    });
  }
}

export { BedrockCLI, BedrockCLIConfig };
