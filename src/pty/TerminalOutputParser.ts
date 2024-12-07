export type CursorControl = {
  type: "cursor";
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

export type EraseControl = {
  type: "erase";
  action: "toEnd" | "toStart" | "screen" | "line" | "lines";
  value?: number;
};

export type StyleControl = {
  type: "style";
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

export type ModeControl = {
  type: "mode";
  mode: string;
  enable: boolean;
};

export type SimpleControl = {
  type: "simple";
  action: "bell" | "backspace" | "tab" | "lineFeed" | "carriageReturn";
};

export type ControlSequence =
  | CursorControl
  | EraseControl
  | StyleControl
  | ModeControl
  | SimpleControl;

export type ParsedTerminalOutput = {
  raw: string;
  plainText: string;
  sequences: ControlSequence[];
  cursorPosition: {
    row: number;
    col: number;
  };
  activeStyles: StyleControl;
  activeModes: Set<string>;
  screenBuffer?: string[][]; // Added to track actual screen content
};

export class TerminalOutputParser {
  private currentState: ParsedTerminalOutput;
  private savedCursorPosition?: { row: number; col: number };

  constructor(
    rows: number = 24,
    cols: number = 80,
    private storeScreenBuffer: boolean = false
  ) {
    this.currentState = {
      raw: "",
      plainText: "",
      sequences: [],
      cursorPosition: { row: 0, col: 0 },
      activeStyles: { type: "style" },
      activeModes: new Set(),
    };
    if (storeScreenBuffer) {
      this.currentState.screenBuffer = Array.from({ length: rows }, () =>
        Array(cols).fill(" ")
      );
    }
  }

  parse(chunk: string): ParsedTerminalOutput {
    this.currentState.raw += chunk;

    // Process chunk character by character
    let i = 0;
    while (i < chunk.length) {
      if (chunk[i] === "\x1B") {
        // ESC
        const sequence = this.parseEscapeSequence(chunk.slice(i));
        if (sequence) {
          i += sequence.consumed;
          this.processSequence(sequence.control);
          continue;
        }
      }

      // Handle simple control characters
      if (chunk[i] < " ") {
        const control = this.parseControlCharacter(chunk[i]);
        if (control) {
          this.processSequence(control);
          i++;
          continue;
        }
      }

      // Regular character
      this.currentState.plainText += chunk[i];
      this.writeToBuffer(chunk[i]);
      this.currentState.cursorPosition.col++;
      i++;
    }

    return { ...this.currentState };
  }

  private parseEscapeSequence(
    text: string
  ): { control: ControlSequence; consumed: number } | null {
    if (text[1] === "[") {
      // CSI sequence
      const match = text.match(/^\x1B\[([?]?\d*(?:;\d*)*)([A-Za-z])/);
      if (match) {
        const [full, params, command] = match;
        return {
          control: this.parseCSISequence(params, command),
          consumed: full.length,
        };
      }
    } else if (text[1] === "]") {
      // OSC sequence
      const match = text.match(/^\x1B\](\d+);([^\x07\x1B]*)?(\x07|\x1B\\)/);
      if (match) {
        // Handle OSC sequences (like window title) if needed
        return {
          control: { type: "simple", action: "bell" },
          consumed: match[0].length,
        };
      }
    } else if (text[1] === "=") {
      // Application Keypad Mode
      return {
        control: { type: "mode", mode: "keypad", enable: true },
        consumed: 2,
      };
    }

    return null;
  }

  private parseControlCharacter(char: string): SimpleControl | null {
    switch (char) {
      case "\x07":
        return { type: "simple", action: "bell" };
      case "\x08":
        return { type: "simple", action: "backspace" };
      case "\x09":
        return { type: "simple", action: "tab" };
      case "\x0A":
        return { type: "simple", action: "lineFeed" };
      case "\x0D":
        return { type: "simple", action: "carriageReturn" };
      default:
        return null;
    }
  }

  private parseCSISequence(params: string, command: string): ControlSequence {
    const parameters = params.split(";").map((p) => parseInt(p) || 0);

    switch (command) {
      case "m": // SGR
        return this.parseStyle(parameters);
      case "H": // Cursor Position
      case "f":
        return {
          type: "cursor",
          action: "position",
          row: (parameters[0] || 1) - 1,
          col: (parameters[1] || 1) - 1,
        };
      case "K": // Erase in Line
        return {
          type: "erase",
          action: "line",
          value: parameters[0] || 0,
        };
      case "J": // Erase in Display
        return {
          type: "erase",
          action: "screen",
          value: parameters[0] || 0,
        };
      case "h": // Set Mode
      case "l": // Reset Mode
        if (params.startsWith("?")) {
          return {
            type: "mode",
            mode: params,
            enable: command === "h",
          };
        }
      // Fall through for non-private modes
    }

    // Default to a style reset if we don't recognize the sequence
    return { type: "style" };
  }

  private parseStyle(parameters: number[]): StyleControl {
    const style: StyleControl = { type: "style" };

    for (const param of parameters) {
      switch (param) {
        case 0: // Reset
          Object.assign(style, { type: "style" });
          break;
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

  private processSequence(sequence: ControlSequence) {
    this.currentState.sequences.push(sequence);

    switch (sequence.type) {
      case "cursor":
        this.processCursorControl(sequence);
        break;
      case "style":
        Object.assign(this.currentState.activeStyles, sequence);
        break;
      case "mode":
        if (sequence.enable) {
          this.currentState.activeModes.add(sequence.mode);
        } else {
          this.currentState.activeModes.delete(sequence.mode);
        }
        break;
      case "simple":
        this.processSimpleControl(sequence);
        break;
    }
  }

  private processCursorControl(control: CursorControl) {
    switch (control.action) {
      case "position":
        if (control.row !== undefined && control.col !== undefined) {
          this.currentState.cursorPosition.row = control.row;
          this.currentState.cursorPosition.col = control.col;
        }
        break;
      case "save":
        this.savedCursorPosition = { ...this.currentState.cursorPosition };
        break;
      case "restore":
        if (this.savedCursorPosition) {
          this.currentState.cursorPosition = { ...this.savedCursorPosition };
        }
        break;
    }
  }

  private processSimpleControl(control: SimpleControl) {
    switch (control.action) {
      case "carriageReturn":
        this.currentState.cursorPosition.col = 0;
        break;
      case "lineFeed":
        this.currentState.cursorPosition.row++;
        break;
      case "backspace":
        if (this.currentState.cursorPosition.col > 0) {
          this.currentState.cursorPosition.col--;
        }
        break;
    }
  }

  private writeToBuffer(char: string) {
    if (!this.storeScreenBuffer) return;
    const { row, col } = this.currentState.cursorPosition;
    if (
      row < this.currentState.screenBuffer!.length &&
      col < this.currentState.screenBuffer![0].length
    ) {
      this.currentState.screenBuffer![row][col] = char;
    }
  }
}
