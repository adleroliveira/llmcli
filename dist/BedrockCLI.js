import chalk from "chalk";
import { BedrockAgent } from "./BedrockAgent.js";
import { processManager } from "./BackgroundProcessManager.js";
import { PtyManager } from "./pty/PtyManager.js";
import { DebugLogger } from "./pty/DebugLogger.js";
import { createPromptDetectorMiddleware } from "./pty/middlewares/PromptMiddleware.js";
DebugLogger.initialize();
class BedrockCLI {
    constructor(config) {
        this.isFirstChunk = true;
        this.tools = new Map();
        this.isRunning = false;
        this.cleanupPromise = null;
        this.MAX_WIDTH = 100;
        this.ptyProcess = null;
        this.isMessageComplete = false;
        this.isProcessing = false;
        this.isShowingStatus = false;
        this.ptyManager = null;
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
    static async create(config) {
        // Check our class-level instance
        if (BedrockCLI.instance) {
            console.error(chalk.red("\nError: Terminal AI Assistant is already running"));
            throw new Error("Terminal AI Assistant instance already exists");
        }
        BedrockCLI.instance = new BedrockCLI(config);
        return BedrockCLI.instance;
    }
    showStatus(message) {
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
    clearStatus() {
        if (this.isProcessing && process.stdout.cursorTo && this.isShowingStatus) {
            process.stdout.cursorTo(0);
            process.stdout.clearLine(0);
            this.isShowingStatus = false;
            this.isProcessing = false;
        }
    }
    wrapText(text, indent = 0) {
        const words = text.split(/(\s+)/);
        const lines = [];
        let currentLine = " ".repeat(indent);
        const maxWidth = this.MAX_WIDTH - indent;
        for (const word of words) {
            if (currentLine.length + word.length > maxWidth) {
                if (currentLine.trim())
                    lines.push(currentLine);
                currentLine = " ".repeat(indent) + word;
            }
            else {
                currentLine += word;
            }
        }
        if (currentLine.trim())
            lines.push(currentLine);
        return lines.join("\n");
    }
    displayWelcomeMessage() {
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
    displayToolsList() {
        console.log(chalk.yellow.bold("\n🔧 Available Tools:"));
        for (const [name, tool] of this.tools.entries()) {
            const spec = tool.spec().toolSpec;
            console.log(chalk.yellow(`\n${name}:`));
            console.log(chalk.gray(this.wrapText(spec.description, 2)));
            console.log(chalk.gray("  Input Schema:"));
            console.log(chalk.gray("  " +
                JSON.stringify(spec.inputSchema.json, null, 2).replace(/\n/g, "\n  ")));
        }
        console.log();
    }
    async handleAiInput(input) {
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
        }
        catch (error) {
            this.clearStatus();
            this.isProcessing = false; // Reset processing state
            console.error(chalk.red("\nFailed to send message:"), error);
            // this.showPrompt();
        }
    }
    handleToolResult(result) {
        // Clear any existing status
        this.clearStatus();
        if (result.name === "executeCommand" ||
            result.name === "executeBackgroundCommand") {
            if (result.status === "success") {
                // Show command with minimal formatting
                process.stdout.write(chalk.cyan(`Command: ${result.result.command}\n`));
                // Output is already cleaned up by the tool, just add one newline
                process.stdout.write(chalk.yellowBright(`Result: ${result.result.output}\n`));
            }
            else {
                process.stdout.write(chalk.red(`Error: ${result.result}\n`));
            }
        }
        // Only show processing status if we're still processing the overall message
        if (!this.isMessageComplete && this.isProcessing) {
            this.showStatus("Processing");
        }
    }
    async cleanup() {
        if (this.cleanupPromise)
            return this.cleanupPromise;
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
                console.log(chalk.cyan("\n👋 Thanks for chatting! See you next time!\n"));
            }
            catch (error) {
                console.error(chalk.red("Error during cleanup:"), error);
                throw error;
            }
        })();
        return this.cleanupPromise;
    }
    async start() {
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
                        process.stdout.write(chalk.cyan(`\n${this.assistantName} [${timestamp}]\n`));
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
            this.ptyManager.use(createPromptDetectorMiddleware());
            // this.ptyManager.use({
            //   // Handle mode switching on '/' input
            //   onInput: (char: string) => {
            //     return char;
            //   },
            //   onOutput: (command) => {
            //     DebugLogger.log("", command);
            //     return command;
            //   },
            // });
            this.ptyManager.initialize();
        }
        catch (error) {
            console.error(chalk.red("Failed to initialize:"), error);
            await this.cleanup();
        }
    }
}
BedrockCLI.instance = null;
export { BedrockCLI };
