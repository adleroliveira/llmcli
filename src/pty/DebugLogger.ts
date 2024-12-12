import * as fs from "fs";
import { Buffer } from "buffer";

export interface LoggerOptions {
  logFile?: string;
  appendToFile?: boolean;
  flushInterval?: number; // in milliseconds
  maxBufferSize?: number; // in bytes
}

export class DebugLogger {
  private static logStream: fs.WriteStream | null = null;
  private static defaultOptions: Required<LoggerOptions> = {
    logFile: "pty-debug.log",
    appendToFile: true,
    flushInterval: 1000, // Flush every second
    maxBufferSize: 8192, // 8KB buffer
  };
  private static options: Required<LoggerOptions>;
  private static buffer: string[] = [];
  private static flushTimeout: NodeJS.Timeout | null = null;
  private static currentBufferSize = 0;

  static initialize(options?: LoggerOptions) {
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
    } catch (error: any) {
      console.error(`Failed to initialize logger: ${error.message}`);
    }
  }

  static log(prefix: string, data?: any): void {
    if (!this.logStream) {
      this.initialize();
    }

    try {
      let logMessage = `${prefix}`;

      if (data !== undefined) {
        if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
          // Convert buffer to actual string content
          logMessage += ` ${data.toString()}`;
        } else if (Array.isArray(data)) {
          // Handle arrays by joining with newlines and proper indentation
          logMessage += "\n" + data.map((item) => `  ${item}`).join("\n");
        } else if (typeof data === "object") {
          // Pretty print objects
          logMessage += "\n " + JSON.stringify(data, null, 2);
        } else {
          // Handle primitive types
          logMessage += ` ${data}`;
        }
      }

      this.writeToBuffer(logMessage + "\n");
    } catch (error: any) {
      console.error(`Logging error: ${error.message}`);
    }
  }

  static logRaw(data: string | Buffer): void {
    if (!this.logStream) {
      this.initialize();
    }

    try {
      // Explicitly convert to string with type assertion
      const message: string = Buffer.isBuffer(data)
        ? data.toString("utf8")
        : data;
      this.writeToBuffer(message);
    } catch (error: any) {
      console.error(`Raw logging error: ${error.message}`);
    }
  }

  static logString(prefix: string, str: string) {
    this.log(`${prefix} (length: ${str.length}):`);
    // Log each character's code point
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const cp = char.codePointAt(0);
      if (cp) {
        this.log(
          `  Char ${i}: "${char}" (U+${cp.toString(16).padStart(4, "0")})`
        );
      }
    }
  }

  static logBytes(prefix: string, bytes: Uint8Array) {
    this.log(`${prefix} (length: ${bytes.length}):`);
    const hexDump = [...bytes]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    this.log(`  Hex: ${hexDump}`);

    // Try interpreting the bytes
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      this.log(`  As UTF-8 text: "${text}"`);
    } catch (e) {
      this.log(`  Invalid UTF-8`);
    }
  }

  static logJSON(message: string, data?: any) {
    const logMessage = `${message}\n`;
    const debugData = data
      ? `${logMessage} ${JSON.stringify(data, null, 2)}\n`
      : "";

    this.writeToBuffer(debugData);
  }

  private static writeToBuffer(data: string): void {
    this.buffer.push(data);
    this.currentBufferSize += Buffer.byteLength(data, "utf8");

    if (this.currentBufferSize >= this.options.maxBufferSize) {
      this.flush();
    }
  }

  private static setupFlushInterval(): void {
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

  private static flush(): void {
    if (this.buffer.length === 0 || !this.logStream) return;

    const data = this.buffer.join("");
    this.logStream.write(data, (error) => {
      if (error) {
        console.error(`Failed to write to log file: ${error.message}`);
      }
    });

    this.buffer = [];
    this.currentBufferSize = 0;
  }

  static close(): Promise<void> {
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

      this.logStream.end((error: any) => {
        if (error) {
          reject(error);
        } else {
          this.logStream = null;
          resolve();
        }
      });
    });
  }
}
