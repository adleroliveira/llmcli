import { VT100Sequence } from "./Command.js";
import { CSISequence } from "./CSISequence.js";
import { TextSequence } from "./TextSequence.js";
import { TerminalController } from "./TerminalController.js";
import { EventEmitter } from "events";

export interface LineBufferState {
  buffer: string;
  cursorPosition: number;
  prompt: string;
  commandBuffer: string;
}

export interface LineBufferEvents {
  line: (command: string) => void;
  prompt: () => void;
}

export declare interface LineBufferManager {
  on<E extends keyof LineBufferEvents>(
    event: E,
    listener: LineBufferEvents[E]
  ): this;
  emit<E extends keyof LineBufferEvents>(
    event: E,
    ...args: Parameters<LineBufferEvents[E]>
  ): boolean;
}

export class LineBufferManager extends EventEmitter {
  private terminalController: TerminalController;
  private state: LineBufferState;
  private readonly PROMPT_CHARS = new Set(["%", "$", "#", "➜", ">", "£"]);

  constructor(controller: TerminalController) {
    super();
    this.terminalController = controller;
    this.state = {
      buffer: "",
      cursorPosition: 0,
      prompt: "",
      commandBuffer: "",
    };
  }

  public getState(): LineBufferState {
    return { ...this.state };
  }

  public processSequence(sequence: VT100Sequence): void {
    if (sequence instanceof TextSequence) {
      this.handleTextSequence(sequence);
    } else if (sequence instanceof CSISequence) {
      switch (sequence.finalByte) {
        case 0x4b: // 'K' - EL (Erase in Line)
          this.handleEraseInLine(sequence);
          break;
        case 0x50: // 'P' - DCH (Delete Character)
          this.handleDeleteCharacter(sequence);
          break;
        case 0x40: // '@' - ICH (Insert Character)
          this.handleInsertCharacter(sequence);
          break;
      }
    }
  }

  private isPromptChar(char: string): boolean {
    return this.PROMPT_CHARS.has(char);
  }

  private findPromptBoundary(
    text: string
  ): { start: number; end: number } | null {
    // Find the last prompt character
    for (let i = text.length - 1; i >= 0; i--) {
      if (this.isPromptChar(text[i])) {
        // Find the start of this prompt segment (the first non-space character backward)
        let start = i;
        while (
          start > 0 &&
          text[start - 1] !== "\n" &&
          text[start - 1] !== "\r"
        ) {
          start--;
        }

        // Include the space after the prompt character if it exists
        const end = i + 1 < text.length && text[i + 1] === " " ? i + 2 : i + 1;

        return { start, end };
      }
    }
    return null;
  }

  private handleTextSequence(sequence: TextSequence): void {
    const text = sequence.text;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      switch (char) {
        case "\b": // Backspace
          if (this.state.cursorPosition > this.state.prompt.length) {
            const beforeCursor = this.state.buffer.slice(
              0,
              this.state.cursorPosition - 1
            );
            const afterCursor = this.state.buffer.slice(
              this.state.cursorPosition
            );
            this.state.buffer = beforeCursor + afterCursor;
            this.state.cursorPosition--;
            this.updateCommandBuffer();
          }
          break;

        case "\r": // Carriage return
          this.state.cursorPosition = 0;
          this.clearBuffer(); // Clear everything on carriage return
          break;

        case "\n": // New line
          if (this.state.commandBuffer) {
            this.emit("line", this.state.commandBuffer);
          }
          this.clearBuffer();
          break;

        default:
          const beforeCursor = this.state.buffer.slice(
            0,
            this.state.cursorPosition
          );
          const afterCursor = this.state.buffer.slice(
            this.state.cursorPosition
          );
          this.state.buffer = beforeCursor + char + afterCursor;
          this.state.cursorPosition++;

          // Only attempt to update prompt if the buffer is empty or just starting
          if (this.state.buffer === char || this.state.buffer.length === 1) {
            this.state.prompt = ""; // Reset prompt when starting new input
          }

          this.updatePrompt();
          this.updateCommandBuffer();
      }
    }
  }

  private updatePrompt(): void {
    const boundary = this.findPromptBoundary(this.state.buffer);
    if (boundary) {
      // Only update prompt if it would be different from current prompt
      const newPrompt = this.state.buffer.slice(boundary.start, boundary.end);
      if (newPrompt !== this.state.prompt) {
        this.state.prompt = newPrompt;
        this.emit("prompt");
      }
    }
  }

  private updateCommandBuffer(): void {
    const boundary = this.findPromptBoundary(this.state.buffer);
    if (boundary) {
      // Get everything after the prompt boundary
      this.state.commandBuffer = this.state.buffer.slice(boundary.end);
    } else {
      this.state.commandBuffer = "";
    }
  }

  private handleEraseInLine(sequence: CSISequence): void {
    const eraseType = sequence.parameters[0]?.value ?? 0;

    switch (eraseType) {
      case 0: // Erase from cursor to end of line
        this.state.buffer = this.state.buffer.slice(
          0,
          this.state.cursorPosition
        );
        break;
      case 1: // Erase from start of line to cursor
        this.state.buffer = this.state.buffer.slice(this.state.cursorPosition);
        this.state.cursorPosition = 0;
        this.state.prompt = ""; // Clear prompt as we're erasing from start
        break;
      case 2: // Erase entire line
        this.clearBuffer();
        break;
    }
    this.updateCommandBuffer();
  }

  private handleDeleteCharacter(sequence: CSISequence): void {
    const count = sequence.parameters[0]?.value ?? 1;

    if (this.state.cursorPosition < this.state.buffer.length) {
      const beforeCursor = this.state.buffer.slice(
        0,
        this.state.cursorPosition
      );
      const afterCursor = this.state.buffer.slice(
        this.state.cursorPosition + count
      );
      this.state.buffer = beforeCursor + afterCursor;
      this.updateCommandBuffer();
    }
  }

  private handleInsertCharacter(sequence: CSISequence): void {
    const count = sequence.parameters[0]?.value ?? 1;
    const spaces = " ".repeat(count);

    const beforeCursor = this.state.buffer.slice(0, this.state.cursorPosition);
    const afterCursor = this.state.buffer.slice(this.state.cursorPosition);
    this.state.buffer = beforeCursor + spaces + afterCursor;
    this.updateCommandBuffer();
  }

  private clearBuffer(): void {
    this.state.buffer = "";
    this.state.cursorPosition = 0;
    this.state.commandBuffer = "";
    this.state.prompt = ""; // Ensure prompt is cleared
  }
}
