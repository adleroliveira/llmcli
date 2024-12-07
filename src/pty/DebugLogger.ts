import * as fs from "fs";

export class DebugLogger {
  private static logStream: fs.WriteStream;
  private static logFile = "pty-debug.log";

  static initialize() {
    this.logStream = fs.createWriteStream(this.logFile, { flags: "a" });
  }

  static log(message: string, data?: any) {
    // const timestamp = new Date().toISOString();
    const logMessage = `${message}\n`;
    const debugData = data
      ? `${logMessage} ${JSON.stringify(data, null, 2)}\n`
      : "";

    // this.logStream.write(logMessage + debugData);
    this.logStream.write(debugData);
  }

  static logRaw(message: string) {
    this.logStream.write(message);
  }

  static close() {
    this.logStream.end();
  }
}
