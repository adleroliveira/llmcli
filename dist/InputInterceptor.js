import { Transform } from "stream";
export class InputInterceptor extends Transform {
    constructor(cli) {
        super();
        this.cli = cli;
        this.buffer = "";
        this.aiMode = false;
        this.lineBuffer = "";
        this.currentPrompt = "";
    }
    _transform(chunk, encoding, callback) {
        const input = chunk.toString();
        // Handle backspace/delete
        if (input === "\b" || input === "\x7f") {
            if (this.lineBuffer.length > 0) {
                this.lineBuffer = this.lineBuffer.slice(0, -1);
                if (this.aiMode) {
                    this.buffer = this.buffer.slice(0, -1);
                    process.stdout.write("\b \b");
                }
            }
            callback(null, this.aiMode ? "" : input);
            return;
        }
        // Handle newline
        if (input.includes("\r") || input.includes("\n")) {
            if (this.aiMode && this.buffer.trim()) {
                this.cli.handleAiInput(this.buffer.trim());
            }
            this.lineBuffer = "";
            this.buffer = "";
            callback(null, this.aiMode ? "\r\n" : input);
            return;
        }
        this.lineBuffer += input;
        // Check for AI mode toggle
        if (this.lineBuffer === "/" && (!this.buffer || this.buffer === "/")) {
            this.toggleAiMode();
            this.lineBuffer = "";
            this.buffer = "";
            callback(null, "");
            return;
        }
        if (this.aiMode) {
            this.buffer += input;
            process.stdout.write(input);
            callback(null, "");
        }
        else {
            callback(null, chunk);
        }
    }
    toggleAiMode() {
        this.aiMode = !this.aiMode;
        process.stdout.write("\r\x1b[K"); // Clear the current line
        if (this.aiMode) {
            this.cli.enterAiMode();
        }
        else {
            this.cli.exitAiMode();
        }
        // Force prompt update after mode switch
        this.cli.updatePrompt(true);
    }
    setCurrentPrompt(prompt) {
        this.currentPrompt = prompt.replace(/\[⚡\]|\[🤖\]/g, "").trim();
    }
    getCurrentPrompt() {
        return this.currentPrompt;
    }
    isInAiMode() {
        return this.aiMode;
    }
}
