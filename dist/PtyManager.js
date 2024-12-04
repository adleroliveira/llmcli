import * as pty from "node-pty";
import { Transform } from "stream";
export class InputInterceptor extends Transform {
    constructor(ptyManager) {
        super();
        this.ptyManager = ptyManager;
    }
    _transform(chunk, _encoding, callback) {
        const input = chunk.toString();
        if (input.trim() === "/") {
            this.ptyManager.toggleAiMode();
            callback(null, ""); // Don't forward the toggle command to the terminal
            return;
        }
        callback(null, chunk); // Forward all other inputs
    }
}
export class PtyManager {
    constructor(config) {
        this.config = config;
        this.ptyProcess = null;
        this.aiMode = false;
        this.lastPrompt = "";
        this.promptRegex = /(?:\r?\n|^)(.*?➜)(\s*$|\s+[^➜\n]*$)/;
        this.initialize();
    }
    initialize() {
        const env = {
            ...process.env,
            BASH_SILENCE_DEPRECATION_WARNING: "1",
        };
        this.ptyProcess = pty.spawn(this.getShell(), [], {
            name: "xterm-color",
            cols: process.stdout.columns,
            rows: process.stdout.rows,
            cwd: process.cwd(),
            env,
        });
        this.inputInterceptor = new InputInterceptor(this);
        process.stdin.setRawMode(true);
        process.stdin.pipe(this.inputInterceptor).pipe(this.ptyProcess);
        this.ptyProcess.onData(this.handlePtyOutput.bind(this));
        process.stdout.on("resize", () => {
            this.ptyProcess?.resize(process.stdout.columns, process.stdout.rows);
        });
    }
    makePrompt() {
        return ` [${this.aiMode ? this.config.aiModePrompt : this.config.defaultPrompt}]`;
    }
    handlePtyOutput(data) {
        const prompt = this.makePrompt();
        // Look for a prompt pattern in the output, including at the end of the line
        const match = data.match(this.promptRegex);
        if (match) {
            // Store the most recent prompt including all ANSI codes
            this.lastPrompt = match[1];
            // Handle both cases: prompt at end of line and prompt with additional text
            const modifiedData = data.replace(/(.*?➜)(\s*$|\s+[^➜\n]*$)/, (_, promptPart, ending) => `${promptPart}${prompt}${ending}`);
            process.stdout.write(modifiedData);
        }
        else {
            process.stdout.write(data);
        }
    }
    getShell() {
        return process.platform === "win32"
            ? "powershell.exe"
            : process.platform === "darwin"
                ? "/bin/zsh"
                : process.env.SHELL || "bash";
    }
    toggleAiMode() {
        this.aiMode = !this.aiMode;
        // Move cursor to beginning of line and clear it
        process.stdout.write("\r\x1b[K");
        // Use the last captured prompt if available, otherwise fall back to basic prompt
        const currentPrompt = this.lastPrompt || `${process.cwd().split("/").pop()} ➜`;
        process.stdout.write(`${currentPrompt}${this.makePrompt()} `);
    }
    kill() {
        this.ptyProcess?.kill();
        this.ptyProcess = null;
    }
}
