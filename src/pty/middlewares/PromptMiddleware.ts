import { ParsedCommand } from "../TerminalParser.js";
import { DebugLogger } from "../../pty/DebugLogger.js";

class SimplePromptDetectorMiddleware {
  private readonly promptMarkers = new Set(["$", "#", "%", "➜", "›"]);
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  private debugLog(message: string, data?: any) {
    if (this.debug) {
      DebugLogger.log(`[PromptDetector] ${message}`, data);
    }
  }

  process(command: ParsedCommand): boolean {
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
    onInput: (char: string) => char,
    onOutput: (command: ParsedCommand) => {
      const isPrompt = detector.process(command);

      if (isPrompt) {
        DebugLogger.log("Detected prompt marker in:", command);
      }

      return command;
    },
  };
};
