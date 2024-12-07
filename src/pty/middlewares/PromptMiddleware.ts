import { ParsedCommand } from "../TerminalParser.js";
import { DebugLogger } from "../../pty/DebugLogger.js";
DebugLogger.initialize();

interface PromptState {
  buffer: string;
  isPrompt: boolean;
  lastClearAction: string | null;
  lastDetectedPrompt: string | null;
  styles: Set<number>;
  currentPromptText: string;
  isTyping: boolean;
}

interface PromptPattern {
  pattern: RegExp;
  name: string;
}

class PromptDetectorMiddleware {
  private state: PromptState;
  private promptPatterns: PromptPattern[];
  private debug: boolean;

  constructor(debug = false) {
    this.state = {
      buffer: "",
      isPrompt: false,
      lastClearAction: null,
      lastDetectedPrompt: null,
      styles: new Set(),
      currentPromptText: "",
      isTyping: false,
    };

    this.debug = debug;

    this.promptPatterns = [
      // Basic patterns
      {
        pattern: /^[\w\-.]+\s*[%#$]\s*$/,
        name: "basic",
      },
      // Root patterns
      {
        pattern: /^root@[\w\-.]+:[\/\w\-.]+[#$]\s*$/,
        name: "root-simple",
      },
      // Oh-my-zsh standard
      {
        pattern: /^[^\n]+\s+(?:via|on|at|in)\s+[^\n]+[➜›%$#]\s*$/,
        name: "omz-standard",
      },
      // Oh-my-zsh with git
      {
        pattern:
          /^[\w\-.\/]+(?:\s+on\s+[\w\-./]+)?(?:\s+[⚡🐍⬢📦]\s+[\w\-./]+)*\s*[➜›%$#]\s*$/u,
        name: "omz-git",
      },
      // Full path prompts
      {
        pattern: /^[\w\-.]+@[\w\-.]+:\/[^\n]+[#$%]\s*$/,
        name: "full-path",
      },
    ];
  }

  private debugLog(message: string, data?: any) {
    if (this.debug) {
      DebugLogger.log(`[PromptDetector] ${message}`, data || "");
    }
  }

  private shouldResetBuffer(text: string): boolean {
    return (
      /password|sudo/.test(text) || text.includes("\n") || text.length > 100
    );
  }

  private cleanText(text: string): string {
    let cleaned = text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");
    cleaned = cleaned.replace(/\u001b\][^\u0007]+\u0007/g, "");
    return cleaned.trim();
  }

  private isLikelyPrompt(text: string): boolean {
    if (!text.trim()) return false;

    const cleanText = this.cleanText(text);
    this.debugLog("Checking cleaned text:", cleanText);

    if (this.shouldResetBuffer(cleanText)) {
      this.debugLog("Resetting buffer due to content:", cleanText);
      this.resetState();
      return false;
    }

    if (cleanText.length <= 1) return false;

    // Don't detect prompts while typing (when there's content after the prompt character)
    const promptCharMatch = cleanText.match(/[%#$➜›](\s*)$/);
    if (!promptCharMatch) {
      this.state.isTyping = true;
      return false;
    }

    // Only spaces should follow the prompt character
    if (promptCharMatch[1] && promptCharMatch[1].length > 1) {
      return false;
    }

    for (const { pattern, name } of this.promptPatterns) {
      if (pattern.test(cleanText)) {
        this.debugLog(`Matched pattern ${name}:`, cleanText);
        this.state.lastDetectedPrompt = cleanText;
        this.state.currentPromptText = text;
        this.state.isTyping = false;
        return true;
      }
    }

    if (/^root@.*:.+/.test(cleanText)) {
      this.debugLog("Potential root prompt building:", cleanText);
      return false;
    }

    this.debugLog("No patterns matched");
    return false;
  }

  private handleStyle(params: number[]) {
    params.forEach((param) => {
      if (param === 0) {
        this.state.styles.clear();
      } else {
        this.state.styles.add(param);
      }
    });
  }

  private resetState() {
    this.state.buffer = "";
    this.state.isPrompt = false;
    this.state.styles.clear();
    this.state.currentPromptText = "";
    this.state.isTyping = false;
  }

  process(command: ParsedCommand): {
    command: ParsedCommand;
    isPrompt: boolean;
    promptText?: string;
  } {
    this.debugLog("Processing command:", command);
    let isPrompt = false;
    let promptText: string | undefined;

    switch (command.type) {
      case "TEXT":
        if (command.text) {
          if (this.shouldResetBuffer(command.text)) {
            this.resetState();
          }

          if (this.state.lastClearAction) {
            this.state.buffer = command.text;
            this.state.lastClearAction = null;
          } else {
            this.state.buffer += command.text;
          }

          this.debugLog("Current buffer:", this.state.buffer);
          isPrompt = this.isLikelyPrompt(this.state.buffer);

          if (isPrompt && !this.state.isTyping) {
            promptText = this.state.buffer;
          }
        }
        break;

      case "SGR":
        this.handleStyle(command.params);
        break;

      case "CLEAR":
        this.state.lastClearAction = command.action;
        if (command.action === "screen" || command.action === "line") {
          this.resetState();
        }
        break;

      case "CONTROL":
        if (
          command.action === "carriageReturn" ||
          command.action === "lineFeed"
        ) {
          // Reset typing state on control characters
          this.state.isTyping = false;
          if (command.action === "lineFeed") {
            this.resetState();
          }
        }
        break;

      case "OSC":
        this.resetState();
        break;
    }

    return {
      command,
      isPrompt,
      promptText,
    };
  }
}

const promptDetector = new PromptDetectorMiddleware(true);

export const createPromptDetectorMiddleware = () => ({
  onInput: (char: string) => char,
  onOutput: (command: ParsedCommand) => {
    const { isPrompt } = promptDetector.process(command);

    if (isPrompt) {
      // You can log or handle the prompt detection here
      DebugLogger.log("Detected prompt:", command.text);
      // DebugLogger.log("Command:", command);
    }

    return command;
  },
});
