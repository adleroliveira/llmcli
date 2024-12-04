import { PtyStreamProcessor } from "./PtyStreamProcessor.js";
export class InputProcessor extends PtyStreamProcessor {
    constructor() {
        super(...arguments);
        this.commandBuffer = "";
    }
    initializeEventHandlers() { }
    async _transform(chunk, _encoding, callback) {
        const input = chunk.toString();
        // Create raw event
        const rawEvent = {
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
                const commandEvent = {
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
        }
        else {
            this.commandBuffer += rawResult.content || input;
        }
        // Pass through the potentially transformed input
        callback(null, Buffer.from(rawResult.content || input));
    }
}
