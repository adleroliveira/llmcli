import { Transform } from "stream";
import { TerminalParser } from "./TerminalParser.js";
import { VT100Parser } from "./TerminalControl/VT100Parser.js";
import { VT100Formatter } from "./TerminalControl/VT100Formatter.js";
import { DebugLogger } from "./DebugLogger.js";
DebugLogger.initialize({
    logFile: "pty-debug.log",
    appendToFile: true,
    flushInterval: 2000, // 2 seconds
    maxBufferSize: 16384, // 16KB
});
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
    *handleInput(chunk) {
        // Process the chunk as a single unit instead of splitting it
        let processedChunk = chunk;
        // Run through input middleware
        for (const middleware of this.inputMiddleware) {
            if (middleware.onInput) {
                const result = middleware.onInput(processedChunk);
                if (result === null) {
                    // Middleware consumed the chunk
                    processedChunk = "";
                    break;
                }
                else if (result) {
                    processedChunk = result;
                }
            }
        }
        if (processedChunk) {
            yield processedChunk;
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
        const vt100parser = new VT100Parser({
            support8BitC1: true,
            maxStringLength: 2048,
            strictMode: true,
        });
        return (data) => {
            for (const sequence of vt100parser.parseString(data)) {
                // DebugLogger.log("", sequence);
                DebugLogger.log("", VT100Formatter.format(sequence));
            }
            callback(data);
        };
    }
}
