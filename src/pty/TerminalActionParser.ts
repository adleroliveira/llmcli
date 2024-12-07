// Types
export type TerminalAction = {
  type: "cursor" | "erase" | "style" | "mode" | "simple" | "data" | "unknown";
  payload:
    | CursorPayload
    | ErasePayload
    | StylePayload
    | ModePayload
    | SimplePayload
    | DataPayload
    | UnknownPayload;
  raw?: string;
};

type UnknownPayload = {
  sequence: string; // The raw sequence that wasn't recognized
};

type CursorPayload = {
  action:
    | "up"
    | "down"
    | "forward"
    | "backward"
    | "nextLine"
    | "prevLine"
    | "column"
    | "position"
    | "save"
    | "restore";
  value?: number;
  row?: number;
  col?: number;
};

type ErasePayload = {
  action: "toEnd" | "toStart" | "screen" | "line" | "lines";
  value?: number;
};

type StylePayload = {
  reset?: boolean;
  foreground?: number;
  background?: number;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  inverse?: boolean;
  hidden?: boolean;
  strikethrough?: boolean;
};

type ModePayload = {
  mode: string;
  enable: boolean;
};

type SimplePayload = {
  action: "bell" | "backspace" | "tab" | "lineFeed" | "carriageReturn";
};

export type DataPayload = {
  content: string;
};

export class TerminalActionParser {
  *parseStream(chunk: string): Generator<TerminalAction> {
    let i = 0;

    while (i < chunk.length) {
      if (chunk[i] === "\x1B") {
        const result = this.parseEscapeSequence(chunk.slice(i));
        if (result) {
          yield result.sequence;
          i += result.consumed;
          continue;
        }
      }

      if (chunk[i] < " ") {
        const controlAction = this.parseControlCharacter(chunk[i]);
        if (controlAction) {
          yield controlAction;
          i++;
          continue;
        }
      }

      yield {
        type: "data",
        payload: {
          content: chunk[i],
        },
        raw: chunk[i],
      };
      i++;
    }
  }

  parse(chunk: string): TerminalAction[] {
    const actions: TerminalAction[] = [];
    let i = 0;

    while (i < chunk.length) {
      if (chunk[i] === "\x1B") {
        const result = this.parseEscapeSequence(chunk.slice(i));
        if (result) {
          actions.push(result.sequence);
          i += result.consumed;
          continue;
        }
      }

      if (chunk[i] < " ") {
        const controlAction = this.parseControlCharacter(chunk[i]);
        if (controlAction) {
          actions.push(controlAction);
          i++;
          continue;
        }
      }

      actions.push({
        type: "data",
        payload: {
          content: chunk[i],
        },
      });
      i++;
    }

    return actions;
  }

  // Rest of the class methods remain the same...
  private parseEscapeSequence(
    text: string
  ): { sequence: TerminalAction; consumed: number } | null {
    if (text[1] === "[") {
      // CSI sequence
      const match = text.match(/^\x1B\[([?]?\d*(?:;\d*)*)([A-Za-z])/);
      if (match) {
        const [full, params, command] = match;
        const sequence = this.parseCSISequence(params, command);
        sequence.raw = full; // Store the original sequence
        return {
          sequence,
          consumed: full.length,
        };
      }
    } else if (text[1] === "]") {
      // OSC sequence
      const match = text.match(/^\x1B\](\d+);([^\x07\x1B]*)?(\x07|\x1B\\)/);
      if (match) {
        return {
          sequence: {
            type: "simple",
            payload: { action: "bell" },
            raw: match[0],
          },
          consumed: match[0].length,
        };
      }
    } else if (text[1] === "=") {
      // Application Keypad Mode
      return {
        sequence: {
          type: "mode",
          payload: { mode: "keypad", enable: true },
          raw: "\x1B=",
        },
        consumed: 2,
      };
    }

    return null;
  }

  private parseControlCharacter(char: string): TerminalAction | null {
    const actionMap: Record<string, SimplePayload["action"]> = {
      "\x07": "bell",
      "\x08": "backspace",
      "\x09": "tab",
      "\x0A": "lineFeed",
      "\x0D": "carriageReturn",
    };

    const action = actionMap[char];
    if (action) {
      return {
        type: "simple",
        payload: { action },
        raw: char,
      };
    }

    return null;
  }

  private parseCSISequence(params: string, command: string): TerminalAction {
    const parameters = params.split(";").map((p) => parseInt(p) || 0);

    switch (command) {
      case "m": // SGR
        return {
          type: "style",
          payload: this.parseStyle(parameters),
        };
      case "H": // Cursor Position
      case "f":
        return {
          type: "cursor",
          payload: {
            action: "position",
            row: (parameters[0] || 1) - 1,
            col: (parameters[1] || 1) - 1,
          },
        };
      case "K": // Erase in Line
        return {
          type: "erase",
          payload: {
            action: "line",
            value: parameters[0] || 0,
          },
        };
      case "J": // Erase in Display
        return {
          type: "erase",
          payload: {
            action: "screen",
            value: parameters[0] || 0,
          },
        };
      case "h": // Set Mode
      case "l": // Reset Mode
        if (params.startsWith("?")) {
          return {
            type: "mode",
            payload: {
              mode: params,
              enable: command === "h",
            },
          };
        }
    }

    return {
      type: "unknown",
      payload: {
        sequence: `\x1B[${params}${command}`,
      },
    };
  }

  private parseStyle(parameters: number[]): StylePayload {
    const style: StylePayload = {
      // Initialize with explicit reset flags when we want to reset everything
      reset: false,
    };

    for (const param of parameters) {
      switch (param) {
        case 0: // Reset
          return { reset: true };
        case 1:
          style.bold = true;
          break;
        case 2:
          style.dim = true;
          break;
        case 3:
          style.italic = true;
          break;
        case 4:
          style.underline = true;
          break;
        case 5:
          style.blink = true;
          break;
        case 7:
          style.inverse = true;
          break;
        case 8:
          style.hidden = true;
          break;
        case 9:
          style.strikethrough = true;
          break;
        case 21:
          style.bold = false;
          break;
        case 22:
          style.bold = style.dim = false;
          break;
        case 23:
          style.italic = false;
          break;
        case 24:
          style.underline = false;
          break;
        case 25:
          style.blink = false;
          break;
        case 27:
          style.inverse = false;
          break;
        case 28:
          style.hidden = false;
          break;
        case 29:
          style.strikethrough = false;
          break;
        default:
          if (param >= 30 && param <= 37) {
            style.foreground = param - 30;
          } else if (param >= 40 && param <= 47) {
            style.background = param - 40;
          }
      }
    }

    return style;
  }
}
