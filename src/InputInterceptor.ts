import { Transform } from "stream";
import { BedrockCLI } from "./BedrockCLI";

export class InputInterceptor extends Transform {
  private buffer: string = "";
  private aiMode: boolean = false;
  private lineBuffer: string = "";
  private currentPrompt: string = "";

  constructor(private cli: BedrockCLI) {
    super();
  }

  _transform(chunk: Buffer, encoding: string, callback: Function) {
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
    } else {
      callback(null, chunk);
    }
  }

  private toggleAiMode() {
    this.aiMode = !this.aiMode;
    process.stdout.write("\r\x1b[K"); // Clear the current line
    if (this.aiMode) {
      this.cli.enterAiMode();
    } else {
      this.cli.exitAiMode();
    }
    // Force prompt update after mode switch
    this.cli.updatePrompt(true);
  }

  public setCurrentPrompt(prompt: string) {
    this.currentPrompt = prompt.replace(/\[⚡\]|\[🤖\]/g, "").trim();
  }

  public getCurrentPrompt(): string {
    return this.currentPrompt;
  }

  public isInAiMode(): boolean {
    return this.aiMode;
  }
}
