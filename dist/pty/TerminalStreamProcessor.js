import { Transform } from "stream";
import { TerminalParser } from "./TerminalParser.js";
export class TerminalStreamProcessor {
    constructor() {
        this.inputMiddleware = [];
        this.outputMiddleware = [];
        this.parser = new TerminalParser();
        this.handleInput = this.handleInput.bind(this);
        this.handleOutput = this.handleOutput.bind(this);
    }
    // Add middleware for input/output processing
    use(middleware) {
        if (middleware.onInput) {
            this.inputMiddleware.push(middleware);
        }
        if (middleware.onOutput) {
            this.outputMiddleware.push(middleware);
        }
    }
    // Process single characters from stdin
    *handleInput(chunk) {
        for (const char of chunk) {
            let processedChar = char;
            // Run through input middleware
            for (const middleware of this.inputMiddleware) {
                if (middleware.onInput) {
                    const result = middleware.onInput(processedChar);
                    if (result === null) {
                        // Middleware consumed the character
                        processedChar = "";
                        break;
                    }
                    else if (result) {
                        processedChar = result;
                    }
                }
            }
            if (processedChar) {
                yield processedChar;
            }
        }
    }
    // Process output from pty
    *handleOutput(command) {
        let currentCommands = [command];
        let nextCommands = [];
        for (const middleware of this.outputMiddleware) {
            if (!middleware.onOutput)
                continue;
            for (const cmd of currentCommands) {
                const result = middleware.onOutput(cmd);
                if (result !== null) {
                    nextCommands.push(result);
                }
            }
            currentCommands = [...nextCommands];
            nextCommands = [];
        }
        yield* currentCommands;
    }
    // Create a transform stream for stdin
    createInputStream() {
        const transform = new Transform({
            transform: (chunk, encoding, callback) => {
                const str = chunk.toString();
                for (const char of this.handleInput(str)) {
                    transform.push(char);
                }
                callback();
            },
        });
        return transform;
    }
    createOutputHandler(callback) {
        return (data) => {
            // DebugLogger.logRaw(data);
            for (const command of this.parser.parse(data)) {
                for (const processedCommand of this.handleOutput(command)) {
                    if (processedCommand.type === "UNKNOWN") {
                        throw new Error("UNKNOWN COMMAND");
                    }
                    if (processedCommand.raw)
                        callback(processedCommand.raw);
                }
            }
        };
    }
}
