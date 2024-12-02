import readline from "readline";
import chalk from "chalk";
import { BedrockAgent } from "./BedrockAgent.js";
import { processManager } from "./BackgroundProcessManager.js";
import path from "path";
class BedrockCLI {
    constructor(config) {
        this.rl = null;
        this.isFirstChunk = true;
        this.isRunning = false;
        this.cleanupPromise = null;
        this.spinnerInterval = null;
        this.spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        this.currentFrame = 0;
        this.MAX_WIDTH = 100;
        this.isThinking = false;
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
            { text: "You are a helpful CLI assistant." },
        ];
        this.sessionId = config.sessionId || "cli-session";
        this.tools = new Map();
        this.assistantName = config.assistantName || "Assistant";
        if (config.tools) {
            for (const tool of config.tools) {
                const toolSpec = tool.spec();
                this.tools.set(toolSpec.toolSpec.name, tool);
            }
        }
    }
    startSpinner(message = "Thinking") {
        if (this.spinnerInterval)
            return;
        this.isThinking = true;
        if (this.rl) {
            this.rl.pause(); // Pause readline to prevent input
        }
        process.stdout.write("\n"); // New line before spinner
        this.spinnerInterval = setInterval(() => {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(chalk.cyan(`${this.spinnerFrames[this.currentFrame]} ${message}...`));
            this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
        }, 80);
    }
    stopSpinner() {
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval);
            this.spinnerInterval = null;
            this.currentFrame = 0;
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            this.isThinking = false;
            if (this.rl) {
                this.rl.resume(); // Resume readline when thinking is done
            }
        }
    }
    getCurrentDirectoryName() {
        const currentPath = process.cwd();
        return path.basename(currentPath);
    }
    updatePrompt() {
        if (this.rl) {
            const currentDir = this.getCurrentDirectoryName();
            this.rl.setPrompt(chalk.blue(`${currentDir}> `));
            this.rl.prompt(true);
        }
    }
    wrapText(text, indent = 0) {
        const words = text.split(/(\s+)/);
        const lines = [];
        let currentLine = " ".repeat(indent);
        const maxWidth = this.MAX_WIDTH - indent;
        for (const word of words) {
            if (currentLine.length + word.length > maxWidth) {
                if (currentLine.trim()) {
                    lines.push(currentLine);
                }
                currentLine = " ".repeat(indent) + word;
            }
            else {
                currentLine += word;
            }
        }
        if (currentLine.trim()) {
            lines.push(currentLine);
        }
        return lines.join("\n");
    }
    displayTimestampedMessage(prefix, message, color) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(color(`${prefix} `) + chalk.gray(`[${timestamp}]`));
        console.log(color(this.wrapText(message)) + "\n");
    }
    displayWelcomeMessage() {
        const title = "Welcome to LLMCLI, the AI CLI Assistant";
        const horizontalLine = "─".repeat(this.MAX_WIDTH);
        console.log(chalk.cyan("\n" + horizontalLine));
        console.log(chalk.cyan(title.padStart(this.MAX_WIDTH / 2 + title.length / 2)));
        console.log(chalk.cyan(horizontalLine + "\n"));
        console.log(chalk.gray("Available commands:"));
        console.log(chalk.gray("  /exit, /quit    Exit session"));
        console.log(chalk.gray("  /tools          List available tools"));
        console.log(chalk.gray("  /clear          Clear terminal"));
        console.log();
        this.displayTimestampedMessage(this.assistantName, "Hello! I'm your AI assistant. How can I help you today?", chalk.cyan);
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
    createReadlineInterface() {
        const currentDir = this.getCurrentDirectoryName();
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue(`${currentDir}> `),
            terminal: true,
            historySize: 1000,
        });
        rl.on("SIGINT", () => {
            if (this.rl) {
                this.rl.close();
            }
        });
        return rl;
    }
    async handleToolResult(result) {
        if (result.name === "executeCommand" ||
            result.name === "executeBackgroundCommand") {
            this.stopSpinner();
            if (result.status === "success") {
                process.stdout.write(chalk.cyan(`\nCommand: ${result.result.command}\n`));
                const toolOutput = result.result;
                const toolOutputString = JSON.stringify(toolOutput.output, null, 2);
                process.stdout.write(chalk.yellowBright(`Result: ${toolOutputString}\n`));
                this.updatePrompt();
            }
            else {
                process.stdout.write(chalk.red(`\nError: ${result.result}\n`));
            }
        }
    }
    async handleCommands(input) {
        const command = input.toLowerCase().trim();
        switch (command) {
            case "/exit":
            case "/quit":
                await this.cleanup();
                process.exit(0);
                return true;
            case "/tools":
                this.displayToolsList();
                return true;
            case "/clear":
                console.clear();
                this.displayWelcomeMessage();
                return true;
            default:
                return false;
        }
    }
    async handleUserInput(line) {
        if (this.isThinking) {
            // Ignore input while thinking
            return;
        }
        const trimmedLine = line.trim();
        // Clear the previous line
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);
        console.log(); // Add a newline
        if (!trimmedLine) {
            this.rl?.prompt();
            return;
        }
        if (await this.handleCommands(trimmedLine)) {
            if (this.isRunning && this.rl) {
                this.rl.prompt();
            }
            return;
        }
        // Display timestamped message for user input
        const timestamp = new Date().toLocaleTimeString();
        console.log(chalk.blue(`You [${timestamp}]`));
        console.log(chalk.white(this.wrapText(trimmedLine)) + "\n");
        try {
            this.startSpinner();
            await this.agent.sendMessage(this.sessionId, trimmedLine);
        }
        catch (error) {
            this.stopSpinner();
            console.error(chalk.red("\nFailed to send message:"), error);
            this.rl?.prompt();
        }
    }
    async cleanup() {
        if (this.cleanupPromise) {
            return this.cleanupPromise;
        }
        this.cleanupPromise = (async () => {
            console.log(chalk.yellow("\nCleaning up background processes..."));
            try {
                // Force kill with true and increased timeout
                await processManager.cleanup(8000, true);
                this.isRunning = false;
                if (this.rl) {
                    this.rl.removeAllListeners();
                    this.rl.close();
                    this.rl = null;
                }
                console.log(chalk.cyan("\n👋 Thanks for chatting! See you next time!\n"));
            }
            catch (error) {
                console.error(chalk.red("Error during cleanup:"), error);
                throw error; // Propagate the error to be handled by the main program
            }
        })();
        return this.cleanupPromise;
    }
    async start() {
        if (this.isRunning) {
            throw new Error("CLI is already running");
        }
        this.isRunning = true;
        return new Promise((resolve) => {
            this.agent
                .createConversation(this.sessionId, {
                systemPrompt: this.systemPrompt,
                onMessage: (chunk) => {
                    if (this.isFirstChunk) {
                        this.stopSpinner();
                        const timestamp = new Date().toLocaleTimeString();
                        process.stdout.write(chalk.cyan(`${this.assistantName} [${timestamp}]\n`));
                        this.isFirstChunk = false;
                    }
                    process.stdout.write(chalk.green(chunk));
                },
                onComplete: () => {
                    this.stopSpinner();
                    this.isFirstChunk = true;
                    process.stdout.write("\n\n");
                    if (this.isRunning && this.rl) {
                        this.rl.prompt();
                    }
                },
                onToolResult: (result) => this.handleToolResult(result),
                onToolUse: (result) => {
                    console.log("Tool will be used", result);
                    this.startSpinner();
                },
                onError: (error) => {
                    this.stopSpinner();
                    console.error(chalk.red("\n❌ Error:"), error);
                    if (this.isRunning && this.rl) {
                        this.rl.prompt();
                    }
                },
            })
                .then(() => {
                this.rl = this.createReadlineInterface();
                this.rl.on("line", async (line) => {
                    await this.handleUserInput(line);
                });
                this.displayWelcomeMessage();
                this.rl.prompt();
            })
                .catch(async (error) => {
                console.error(chalk.red("Failed to initialize conversation:"), error);
                await this.cleanup();
                resolve();
            });
        });
    }
}
export { BedrockCLI };
