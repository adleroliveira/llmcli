import { PtyStreamProcessor, StreamEvent } from "./PtyStreamProcessor.js";
import { DebugLogger } from "./DebugLogger.js";

export class InputProcessor extends PtyStreamProcessor {
  private commandBuffer: string = "";

  protected initializeEventHandlers(): void {}

  async _transform(chunk: Buffer, _encoding: string, callback: Function) {
    const input = chunk.toString();

    // Create raw event
    const rawEvent: StreamEvent = {
      type: "raw",
      content: input,
      raw: input,
      timestamp: Date.now(),
    };

    const rawResult = await this.processWithMiddlewares(rawEvent);

    if (rawResult.preventDefault) {
      callback(null);
      return;
    }

    // Update command buffer and handle commands
    if (input === "\r" || input === "\n") {
      if (this.commandBuffer) {
        const commandEvent: StreamEvent = {
          type: "command",
          content: this.commandBuffer,
          raw: this.commandBuffer,
          timestamp: Date.now(),
        };

        const commandResult = await this.processWithMiddlewares(commandEvent);
        if (!commandResult.preventDefault) {
          this.emit("command", commandResult.event);
        }

        this.commandBuffer = "";
      }
    } else {
      this.commandBuffer += rawResult.content || input;
    }

    // Pass through the potentially transformed input
    callback(null, Buffer.from(rawResult.content || input));
  }
}
