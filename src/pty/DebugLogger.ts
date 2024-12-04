import * as fs from "fs";

export class DebugLogger {
  private static logStream: fs.WriteStream;
  private static logFile = "pty-debug.log";

  static initialize() {
    this.logStream = fs.createWriteStream(this.logFile, { flags: "a" });
  }

  static log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    const debugData = data ? `${JSON.stringify(data, null, 2)}\n` : "";

    this.logStream.write(logMessage + debugData);
  }

  static close() {
    this.logStream.end();
  }
}
