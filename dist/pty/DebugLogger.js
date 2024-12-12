import * as fs from "fs";
import { Buffer } from "buffer";
export class DebugLogger {
    static initialize(options) {
        this.options = { ...this.defaultOptions, ...options };
        try {
            this.logStream = fs.createWriteStream(this.options.logFile, {
                flags: this.options.appendToFile ? "a" : "w",
                encoding: "utf8",
            });
            this.logStream.on("error", (error) => {
                console.error(`Logger error: ${error.message}`);
            });
            // Setup periodic flush
            this.setupFlushInterval();
        }
        catch (error) {
            console.error(`Failed to initialize logger: ${error.message}`);
        }
    }
    static log(prefix, data) {
        if (!this.logStream) {
            this.initialize();
        }
        try {
            let logMessage = `${prefix}`;
            if (data !== undefined) {
                if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
                    // Convert buffer to actual string content
                    logMessage += ` ${data.toString()}`;
                }
                else if (Array.isArray(data)) {
                    // Handle arrays by joining with newlines and proper indentation
                    logMessage += "\n" + data.map((item) => `  ${item}`).join("\n");
                }
                else if (typeof data === "object") {
                    // Pretty print objects
                    logMessage += "\n " + JSON.stringify(data, null, 2);
                }
                else {
                    // Handle primitive types
                    logMessage += ` ${data}`;
                }
            }
            this.writeToBuffer(logMessage + "\n");
        }
        catch (error) {
            console.error(`Logging error: ${error.message}`);
        }
    }
    static logRaw(data) {
        if (!this.logStream) {
            this.initialize();
        }
        try {
            // Explicitly convert to string with type assertion
            const message = Buffer.isBuffer(data)
                ? data.toString("utf8")
                : data;
            this.writeToBuffer(message);
        }
        catch (error) {
            console.error(`Raw logging error: ${error.message}`);
        }
    }
    static logString(prefix, str) {
        this.log(`${prefix} (length: ${str.length}):`);
        // Log each character's code point
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const cp = char.codePointAt(0);
            if (cp) {
                this.log(`  Char ${i}: "${char}" (U+${cp.toString(16).padStart(4, "0")})`);
            }
        }
    }
    static logBytes(prefix, bytes) {
        this.log(`${prefix} (length: ${bytes.length}):`);
        const hexDump = [...bytes]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
        this.log(`  Hex: ${hexDump}`);
        // Try interpreting the bytes
        try {
            const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
            this.log(`  As UTF-8 text: "${text}"`);
        }
        catch (e) {
            this.log(`  Invalid UTF-8`);
        }
    }
    static logJSON(message, data) {
        const logMessage = `${message}\n`;
        const debugData = data
            ? `${logMessage} ${JSON.stringify(data, null, 2)}\n`
            : "";
        this.writeToBuffer(debugData);
    }
    static writeToBuffer(data) {
        this.buffer.push(data);
        this.currentBufferSize += Buffer.byteLength(data, "utf8");
        if (this.currentBufferSize >= this.options.maxBufferSize) {
            this.flush();
        }
    }
    static setupFlushInterval() {
        if (this.flushTimeout) {
            clearInterval(this.flushTimeout);
        }
        this.flushTimeout = setInterval(() => {
            this.flush();
        }, this.options.flushInterval);
        // Ensure the interval doesn't keep the process alive
        if (this.flushTimeout.unref) {
            this.flushTimeout.unref();
        }
    }
    static flush() {
        if (this.buffer.length === 0 || !this.logStream)
            return;
        const data = this.buffer.join("");
        this.logStream.write(data, (error) => {
            if (error) {
                console.error(`Failed to write to log file: ${error.message}`);
            }
        });
        this.buffer = [];
        this.currentBufferSize = 0;
    }
    static close() {
        return new Promise((resolve, reject) => {
            this.flush(); // Flush any remaining data
            if (this.flushTimeout) {
                clearInterval(this.flushTimeout);
                this.flushTimeout = null;
            }
            if (!this.logStream) {
                resolve();
                return;
            }
            this.logStream.end((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    this.logStream = null;
                    resolve();
                }
            });
        });
    }
}
DebugLogger.logStream = null;
DebugLogger.defaultOptions = {
    logFile: "pty-debug.log",
    appendToFile: true,
    flushInterval: 1000, // Flush every second
    maxBufferSize: 8192, // 8KB buffer
};
DebugLogger.buffer = [];
DebugLogger.flushTimeout = null;
DebugLogger.currentBufferSize = 0;
