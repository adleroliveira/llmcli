import * as fs from "fs";
export class DebugLogger {
    static initialize() {
        this.logStream = fs.createWriteStream(this.logFile, { flags: "a" });
    }
    static log(message, data) {
        // const timestamp = new Date().toISOString();
        const logMessage = `${message}\n`;
        const debugData = data
            ? `${logMessage} ${JSON.stringify(data, null, 2)}\n`
            : "";
        // this.logStream.write(logMessage + debugData);
        this.logStream.write(debugData);
    }
    static logRaw(message) {
        this.logStream.write(message);
    }
    static close() {
        this.logStream.end();
    }
}
DebugLogger.logFile = "pty-debug.log";
