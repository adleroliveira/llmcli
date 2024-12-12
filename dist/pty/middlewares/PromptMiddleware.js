import { DebugLogger } from "../../pty/DebugLogger.js";
class SimplePromptDetectorMiddleware {
    constructor(debug = false) {
        this.promptMarkers = new Set(["$", "#", "%", "➜", "›"]);
        this.debug = debug;
    }
    debugLog(message, data) {
        if (this.debug) {
            DebugLogger.log(`[PromptDetector] ${message}`, data);
        }
    }
    process(command) {
        this.debugLog("Processing command:", command);
        if (command.type === "TEXT" && command.text) {
            const text = command.text;
            // Check if text ends with a prompt marker followed by a space
            for (const marker of this.promptMarkers) {
                if (text.endsWith(`${marker} `)) {
                    return true;
                }
            }
        }
        return false;
    }
}
export const createPromptDetectorMiddleware = (debug = false) => {
    const detector = new SimplePromptDetectorMiddleware(debug);
    return {
        onInput: (char) => char,
        onOutput: (command) => {
            const isPrompt = detector.process(command);
            if (isPrompt) {
                DebugLogger.log("Detected prompt marker in:", command);
            }
            return command;
        },
    };
};
