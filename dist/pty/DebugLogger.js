import * as fs from "fs";
export class DebugLogger {
    static initialize() {
        this.logStream = fs.createWriteStream(this.logFile, { flags: "a" });
    }
    static log(message, data) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        const debugData = data ? `${JSON.stringify(data, null, 2)}\n` : "";
        this.logStream.write(logMessage + debugData);
    }
    static close() {
        this.logStream.end();
    }
}
DebugLogger.logFile = "pty-debug.log";
