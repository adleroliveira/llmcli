import { PtyStreamProcessor, StreamEvent } from "./PtyStreamProcessor.js";
import { DebugLogger } from "./DebugLogger.js";

DebugLogger.initialize();
export class OutputProcessor extends PtyStreamProcessor {
  protected initializeEventHandlers(): void {}

  private stripAnsiSequences(str: string): string {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  }

  async _transform(chunk: Buffer, _encoding: string, callback: Function) {
    const output = chunk.toString();
    this.buffer += output;

    // Create raw event
    const rawEvent: StreamEvent = {
      type: "raw",
      content: output,
      raw: output,
      timestamp: Date.now(),
    };

    const rawResult = await this.processWithMiddlewares(rawEvent);

    // First, pass through the immediate output for display if not prevented
    if (!rawResult.preventDefault) {
      callback(null, Buffer.from(rawResult.content || output));
    }

    // Process complete lines
    if (this.buffer.includes("\n") || this.buffer.includes("\r")) {
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const lineEvent: StreamEvent = {
          type: "line",
          content: this.stripAnsiSequences(line),
          raw: line,
          timestamp: Date.now(),
        };

        const lineResult = await this.processWithMiddlewares(lineEvent);
        if (!lineResult.preventDefault) {
          this.emit("line", lineResult.event);
        }
      }
    }

    callback();
  }
}
