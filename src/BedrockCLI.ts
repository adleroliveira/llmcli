import * as pty from "node-pty";
import chalk from "chalk";
import { BedrockAgent, Tool } from "./BedrockAgent.js";
import { SystemContentBlock } from "@aws-sdk/client-bedrock-runtime";
import { AwsCredentials } from "./ConfigManager";
import { processManager } from "./BackgroundProcessManager.js";
// import { PtyManager } from "./PtyManager.js";
import { PtyManager } from "./pty/PtyManager.js";
import { setupModeSwitching } from "./pty/middlewares/setupModeSwitching.js";

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
  assistantName?: string;
}

class BedrockCLI {
  private static instance: BedrockCLI | null = null;
  private agent: BedrockAgent;
  private sessionId: string;
  private isFirstChunk: boolean = true;
  private tools: Map<string, Tool> = new Map();
  private isRunning: boolean = false;
  private cleanupPromise: Promise<void> | null = null;
  private readonly assistantName: string;
  private readonly MAX_WIDTH = 100;
  private ptyProcess: pty.IPty | null = null;
  private isMessageComplete: boolean = false;
  private isProcessing: boolean = false;
  private isShowingStatus: boolean = false;
  private ptyManager: PtyManager | null = null;

  constructor(config: BedrockCLIConfig) {
    if (process.env.BEDROCK_CLI_RUNNING === "true") {
      throw new Error("Cannot create nested Terminal AI Assistant instance");
    }

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
      this.tools.set(tool.spec().toolSpec.name, tool);
    });

    this.sessionId = config.sessionId || "cli-session";
    this.assistantName = config.assistantName || "Assistant";
  }

  public static async create(config: BedrockCLIConfig): Promise<BedrockCLI> {
    // Check our class-level instance
    if (BedrockCLI.instance) {
      console.error(
        chalk.red("\nError: Terminal AI Assistant is already running")
      );
      throw new Error("Terminal AI Assistant instance already exists");
    }

    BedrockCLI.instance = new BedrockCLI(config);
    return BedrockCLI.instance;
  }

  private showStatus(message: string) {
    if (!this.isProcessing) {
      this.isProcessing = true;
    }

    // Clear and update status line
    if (process.stdout.cursorTo) {
      process.stdout.cursorTo(0);
      process.stdout.clearLine(0);
      process.stdout.write(chalk.cyan(`${message}...`));
      this.isShowingStatus = true;
    }
  }

  private clearStatus() {
    if (this.isProcessing && process.stdout.cursorTo && this.isShowingStatus) {
      process.stdout.cursorTo(0);
      process.stdout.clearLine(0);
      this.isShowingStatus = false;
      this.isProcessing = false;
    }
  }

  private wrapText(text: string, indent: number = 0): string {
    const words = text.split(/(\s+)/);
    const lines: string[] = [];
    let currentLine = " ".repeat(indent);
    const maxWidth = this.MAX_WIDTH - indent;

    for (const word of words) {
      if (currentLine.length + word.length > maxWidth) {
        if (currentLine.trim()) lines.push(currentLine);
        currentLine = " ".repeat(indent) + word;
      } else {
        currentLine += word;
      }
    }

    if (currentLine.trim()) lines.push(currentLine);
    return lines.join("\n");
  }

  private displayWelcomeMessage() {
    console.log("\n" + chalk.cyan("─".repeat(50)));
    console.log(chalk.cyan("LLMCLI"));

    console.log(chalk.gray("\nModes:"));
    console.log(chalk.yellow("[⚡] Terminal"));
    console.log(chalk.cyan("[🤖] AI"));

    console.log(chalk.gray("\nCommands:"));
    console.log(chalk.gray("/ - Toggle between modes"));
    console.log(chalk.gray("In AI mode:"));
    console.log(chalk.gray("  exit, quit - Close session"));
    console.log(chalk.gray("  tools - List tools"));
    console.log(chalk.gray("  clear - Clear screen\n"));
  }

  private displayToolsList() {
    console.log(chalk.yellow.bold("\n🔧 Available Tools:"));
    for (const [name, tool] of this.tools.entries()) {
      const spec = tool.spec().toolSpec;
      console.log(chalk.yellow(`\n${name}:`));
      console.log(chalk.gray(this.wrapText(spec.description, 2)));
      console.log(chalk.gray("  Input Schema:"));
      console.log(
        chalk.gray(
          "  " +
            JSON.stringify(spec.inputSchema.json, null, 2).replace(
              /\n/g,
              "\n  "
            )
        )
      );
    }
    console.log();
  }

  public async handleAiInput(input: string) {
    const trimmedInput = input.trim().toLowerCase();

    // Handle special commands
    switch (trimmedInput) {
      case "exit":
      case "quit":
        await this.cleanup();
        process.exit(0);
        return;
      case "tools":
        this.displayToolsList();
        // this.showPrompt();
        return;
      case "clear":
        console.clear();
        this.displayWelcomeMessage();
        // this.showPrompt();
        return;
    }

    if (!trimmedInput) {
      // this.showPrompt();
      return;
    }

    try {
      process.stdout.write("\n");
      this.isProcessing = true; // Set this before showing status
      this.showStatus("Thinking");
      await this.agent.sendMessage(this.sessionId, input).catch((error) => {
        this.clearStatus();
        this.isProcessing = false; // Reset processing state
        console.error(chalk.red("\nFailed to send message:"), error);
        // this.showPrompt();
      });
    } catch (error) {
      this.clearStatus();
      this.isProcessing = false; // Reset processing state
      console.error(chalk.red("\nFailed to send message:"), error);
      // this.showPrompt();
    }
  }

  private handleToolResult(result: any) {
    // Clear any existing status
    this.clearStatus();

    if (
      result.name === "executeCommand" ||
      result.name === "executeBackgroundCommand"
    ) {
      if (result.status === "success") {
        // Show command with minimal formatting
        process.stdout.write(chalk.cyan(`Command: ${result.result.command}\n`));

        // Output is already cleaned up by the tool, just add one newline
        process.stdout.write(
          chalk.yellowBright(`Result: ${result.result.output}\n`)
        );
      } else {
        process.stdout.write(chalk.red(`Error: ${result.result}\n`));
      }
    }

    // Only show processing status if we're still processing the overall message
    if (!this.isMessageComplete && this.isProcessing) {
      this.showStatus("Processing");
    }
  }

  async cleanup(): Promise<void> {
    if (this.cleanupPromise) return this.cleanupPromise;

    this.cleanupPromise = (async () => {
      console.log(chalk.yellow("\nCleaning up background processes..."));
      try {
        await processManager.cleanup(8000, true);
        this.isRunning = false;

        if (this.ptyProcess) {
          this.ptyProcess.kill();
          this.ptyProcess = null;
        }

        process.stdin.setRawMode(false);
        process.stdin.removeAllListeners("data");

        // Clear all instance references
        delete process.env.BEDROCK_CLI_RUNNING;
        BedrockCLI.instance = null;

        console.log(
          chalk.cyan("\n👋 Thanks for chatting! See you next time!\n")
        );
      } catch (error) {
        console.error(chalk.red("Error during cleanup:"), error);
        throw error;
      }
    })();

    return this.cleanupPromise;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.error(chalk.red("\nError: CLI is already running"));
      throw new Error("CLI is already running");
    }

    process.env.BEDROCK_CLI_RUNNING = "true";
    this.isRunning = true;

    try {
      await this.agent.createConversation(this.sessionId, {
        systemPrompt: [{ text: "You are a helpful CLI assistant." }],
        onMessage: (chunk) => {
          if (this.isFirstChunk) {
            this.clearStatus();
            const timestamp = new Date().toLocaleTimeString();
            process.stdout.write(
              chalk.cyan(`\n${this.assistantName} [${timestamp}]\n`)
            );
            this.isFirstChunk = false;
          }
          process.stdout.write(chalk.green(chunk));
        },
        onComplete: () => {
          this.isMessageComplete = true;
          this.clearStatus();
          this.isFirstChunk = true;
          this.isProcessing = false; // Reset processing state
          process.stdout.write("\n");
          // this.showPrompt();
        },
        onToolResult: this.handleToolResult.bind(this),
        onToolUse: () => {
          if (!this.isProcessing) {
            this.showStatus("Executing command");
          }
        },
        onError: (error) => {
          this.clearStatus();
          console.error(chalk.red("\nError:"), error);
          // this.showPrompt();
        },
      });

      this.displayWelcomeMessage();
      this.ptyManager = new PtyManager();
      setupModeSwitching(this.ptyManager);
      // this.ptyManager.onOutput("prompt", (event) => {
      //   const aiMode = false; // Your AI mode toggle
      //   const marker = aiMode ? "[AI]" : "[Normal]";

      //   console.log(`Prompt(${event.content})`);

      //   return {
      //     content: `${event.content}`,
      //     metadata: { aiMode },
      //   };
      // });
      // this.ptyManager.registerCommand("quit", async () => {
      //   await this.cleanup();
      //   process.exit(0);
      // });
    } catch (error) {
      console.error(chalk.red("Failed to initialize:"), error);
      await this.cleanup();
    }
  }
}

export { BedrockCLI, BedrockCLIConfig };
