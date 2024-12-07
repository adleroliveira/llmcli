// import { DebugLogger } from "./DebugLogger";

// Token types for terminal sequences
export type TokenType =
  | "ESC" // Escape character
  | "CSI" // Control Sequence Introducer
  | "OSC" // Operating System Command
  | "PARAMETER" // Numeric parameter
  | "PARAMETER_SEP" // Parameter separator (;)
  | "COMMAND" // Command character
  | "CONTROL" // Control character
  | "TEXT" // Regular text
  | "QUESTION" // Question mark for private sequences
  | "STRING" // OSC string content
  | "ST" // String terminator
  | "CHARSET";

export interface Token {
  type: TokenType;
  value: string;
  position: number;
  raw: string;
}

export type LexerState = {
  buffer: string;
  mode: "normal" | "escape" | "csi" | "osc";
  startPos: number;
  paramBuffer: string;
};

export class TerminalLexer {
  private pos: number = 0;
  private input: string = "";
  private state: LexerState = {
    buffer: "",
    mode: "normal",
    startPos: 0,
    paramBuffer: "",
  };

  *tokenize(input: string): Generator<Token> {
    // DebugLogger.log("Current state before processing:", {
    //   mode: this.state.mode,
    //   buffer: this.state.buffer,
    //   startPos: this.state.startPos,
    //   paramBuffer: this.state.paramBuffer,
    //   input: input,
    // });

    // If we're in the middle of a CSI sequence, append to paramBuffer
    if (this.state.mode === "csi") {
      this.input = input;
      this.pos = 0;
      yield* this.handleCSISequence(this.state.startPos);
      return;
    }

    // If we have a buffer from a previous escape sequence
    if (this.state.buffer) {
      this.input = this.state.buffer + input;
      this.state.buffer = "";
    } else {
      this.input = input;
    }
    this.pos = 0;

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      // If we're in escape mode and don't have enough characters
      if (this.state.mode === "escape" && this.input.length - this.pos < 2) {
        this.state.buffer = this.input.slice(this.pos);
        break;
      }

      switch (this.state.mode) {
        case "normal":
          if (char === "\x1B") {
            // Don't process escape if it's the last character
            if (this.pos === this.input.length - 1) {
              this.state.mode = "escape";
              this.state.buffer = "\x1B";
              this.state.startPos = this.pos;
              break;
            }
            yield* this.handleEscapeSequence();
          } else if (char === "[" && this.state.buffer === "") {
            const startPos = this.pos;
            yield {
              type: "CSI",
              value: "[",
              position: startPos,
              raw: "[",
            };
            this.pos++;
            this.state.mode = "csi";
            this.state.startPos = startPos;
          } else if (char < " ") {
            yield* this.handleControlCharacter();
          } else {
            yield* this.handleText();
          }
          break;

        case "escape":
          if (this.input.length - this.pos >= 2) {
            yield* this.handleEscapeSequence();
          }
          break;

        case "csi":
          yield* this.handleCSISequence(this.state.startPos);
          break;

        case "osc":
          yield* this.handleOSCSequence();
          break;
      }
    }
  }

  private *handleEscapeSequence(): Generator<Token> {
    const startPos = this.pos;

    // Special handling for complete two-character sequences
    if (
      this.pos + 1 < this.input.length &&
      (this.input[this.pos + 1] === "=" || this.input[this.pos + 1] === ">")
    ) {
      yield {
        type: "COMMAND",
        value: this.input.slice(this.pos, this.pos + 2),
        position: startPos,
        raw: this.input.slice(this.pos, this.pos + 2),
      };
      this.pos += 2;
      this.state.mode = "normal";
      return;
    }

    // If we don't have another character to look at, buffer the escape
    if (this.pos + 1 >= this.input.length) {
      this.state.mode = "escape";
      this.state.startPos = startPos;
      return;
    }

    // At this point we know we have at least one more character
    const nextChar = this.input[this.pos + 1];

    if (nextChar === "[") {
      yield {
        type: "ESC",
        value: "\x1B",
        position: startPos,
        raw: "\x1B",
      };
      this.pos++;
      yield {
        type: "CSI",
        value: "[",
        position: this.pos,
        raw: "[",
      };
      this.pos++;
      this.state.mode = "csi";
      this.state.startPos = startPos;
    } else if (nextChar === "]") {
      yield {
        type: "ESC",
        value: "\x1B",
        position: startPos,
        raw: "\x1B",
      };
      this.pos++;
      yield {
        type: "OSC",
        value: "]",
        position: this.pos,
        raw: "]",
      };
      this.pos++;
      this.state.mode = "osc";
    } else if (
      nextChar === "(" ||
      nextChar === ")" ||
      nextChar === "*" ||
      nextChar === "+"
    ) {
      // Character set selection sequences need one more character
      if (this.pos + 2 >= this.input.length) {
        // Not enough characters, buffer the incomplete sequence
        this.state.mode = "escape";
        this.state.startPos = startPos;
        return;
      }

      const charsetSelector = nextChar;
      const charset = this.input[this.pos + 2];

      yield {
        type: "ESC",
        value: "\x1B",
        position: startPos,
        raw: "\x1B",
      };
      yield {
        type: "CHARSET", // New token type for charset selection
        value: charsetSelector + charset,
        position: this.pos + 1,
        raw: charsetSelector + charset,
      };
      this.pos += 3;
      this.state.mode = "normal";
    } else {
      // Handle other escape sequences as before
      yield {
        type: "ESC",
        value: "\x1B",
        position: startPos,
        raw: "\x1B",
      };
      this.pos++;
      yield {
        type: "COMMAND",
        value: nextChar,
        position: this.pos,
        raw: nextChar,
      };
      this.pos++;
      this.state.mode = "normal";
    }
  }

  private *handleCSISequence(startPos: number): Generator<Token> {
    let paramBuffer = this.state.paramBuffer;
    let paramStart = startPos + 2;
    let sequenceComplete = false;

    // First, check for question mark if we're just starting the sequence
    if (
      this.state.paramBuffer === "" &&
      this.pos < this.input.length &&
      this.input[this.pos] === "?"
    ) {
      yield {
        type: "QUESTION",
        value: "?",
        position: this.pos,
        raw: "?",
      };
      this.pos++;
      paramStart++;
    }

    while (this.pos < this.input.length && !sequenceComplete) {
      const char = this.input[this.pos];

      if (/[0-9;]/.test(char)) {
        paramBuffer += char;
        this.pos++;
        continue;
      }

      if (/[A-Za-z=@\[\]^_`{|}~]/.test(char)) {
        if (paramBuffer.length > 0) {
          const params = paramBuffer.split(";");
          for (let i = 0; i < params.length; i++) {
            if (params[i].length > 0) {
              yield {
                type: "PARAMETER",
                value: params[i],
                position: paramStart + (i > 0 ? 1 : 0),
                raw: params[i],
              };
            }
            if (i < params.length - 1) {
              yield {
                type: "PARAMETER_SEP",
                value: ";",
                position: paramStart + params[i].length,
                raw: ";",
              };
            }
          }
        }

        // Special case for 'h=' sequence
        if (
          char === "h" &&
          this.pos + 1 < this.input.length &&
          this.input[this.pos + 1] === "="
        ) {
          yield {
            type: "COMMAND",
            value: "h=",
            position: this.pos,
            raw: "h=",
          };
          this.pos += 2;
        } else {
          yield {
            type: "COMMAND",
            value: char,
            position: this.pos,
            raw: char,
          };
          this.pos++;
        }
        sequenceComplete = true;
        break;
      }

      this.pos++;
    }

    if (sequenceComplete) {
      // Reset state
      this.state.mode = "normal";
      this.state.buffer = "";
      this.state.paramBuffer = "";

      // If there's remaining text after the command, process it
      if (this.pos < this.input.length) {
        yield* this.handleText();
      }
    } else {
      // Store incomplete parameters
      this.state.paramBuffer = paramBuffer;
    }
  }

  private *handleOSCSequence(): Generator<Token> {
    let buffer = "";
    const stringStart = this.pos;
    let sequenceComplete = false;

    while (this.pos < this.input.length && !sequenceComplete) {
      const char = this.input[this.pos];

      if (char === "\x07") {
        if (buffer.length > 0) {
          yield {
            type: "STRING",
            value: buffer,
            position: stringStart,
            raw: buffer,
          };
        }
        yield {
          type: "ST",
          value: "\x07",
          position: this.pos,
          raw: "\x07",
        };
        this.pos++;
        sequenceComplete = true;
        break;
      }

      if (
        char === "\x1B" &&
        this.pos + 1 < this.input.length &&
        this.input[this.pos + 1] === "\\"
      ) {
        if (buffer.length > 0) {
          yield {
            type: "STRING",
            value: buffer,
            position: stringStart,
            raw: buffer,
          };
        }
        yield {
          type: "ST",
          value: "\x1B\\",
          position: this.pos,
          raw: "\x1B\\",
        };
        this.pos += 2;
        sequenceComplete = true;
        break;
      }

      buffer += char;
      this.pos++;
    }

    if (sequenceComplete) {
      this.state.mode = "normal";
      this.state.buffer = "";
    }
  }

  private *handleControlCharacter(): Generator<Token> {
    const pos = this.pos++;
    yield {
      type: "CONTROL",
      value: this.input[pos],
      position: pos,
      raw: this.input[pos],
    };
  }

  private *handleText(): Generator<Token> {
    const startPos = this.pos;
    let buffer = "";

    while (
      this.pos < this.input.length &&
      this.input[this.pos] >= " " &&
      this.input[this.pos] !== "[" &&
      this.input[this.pos] !== "\x1B"
    ) {
      buffer += this.input[this.pos++];
    }

    if (buffer.length > 0) {
      yield {
        type: "TEXT",
        value: buffer,
        position: startPos,
        raw: buffer,
      };
    }
  }
}
