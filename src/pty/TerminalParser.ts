import { TerminalLexer, Token } from "./TerminalLexer.js";
// import { DebugLogger } from "./DebugLogger.js";
// DebugLogger.initialize();

export type ParsedCommand = {
  type:
    | "SGR"
    | "CURSOR"
    | "CLEAR"
    | "OSC"
    | "TEXT"
    | "CONTROL"
    | "MARGIN"
    | "PRIVATE_MODE"
    | "CHARSET"
    | "LINE_EDIT"
    | "WINDOW"
    | "STATUS"
    | "DCS"
    | "DEVICE"
    | "UNKNOWN";
  action: string;
  params: number[];
  text?: string;
  raw?: string;
  private?: boolean;
  debug?: {
    tokens: Array<{
      type: string;
      value: string;
      raw: string;
    }>;
  };
};

export class TerminalParser {
  private lexer: TerminalLexer;
  private isPrivateMode: boolean = false;
  private tokenBuffer: Token[] = [];
  private debugTokenBuffer: Token[] = [];
  private isDCSSequence: boolean = false;
  private dcsBuffer: string = "";
  private incompleteCommand: {
    command: Partial<ParsedCommand>;
    tokens: Token[];
  } | null = null;

  constructor() {
    this.lexer = new TerminalLexer();
  }

  private isCompleteCommand(
    command: Partial<ParsedCommand>,
    tokens: Token[]
  ): boolean {
    // If no command or tokens, it's not complete
    if (!command || tokens.length === 0) {
      return false;
    }

    // Check last token
    const lastToken = tokens[tokens.length - 1];

    // OSC commands must end with BEL or ST
    if (command.type === "OSC") {
      return (
        (lastToken.type === "CONTROL" && lastToken.value === "\x07") ||
        lastToken.type === "ST"
      );
    }

    // First check if it ends with a COMMAND token
    if (lastToken.type !== "COMMAND") {
      return false;
    }

    // For SGR commands
    if (lastToken.value === "m") {
      // We should have at minimum: ESC, CSI, COMMAND
      if (tokens.length < 3) return false;

      // Verify sequence starts correctly
      if (tokens[0].type !== "ESC") return false;
      if (tokens[1].type !== "CSI") return false;

      // All tokens between CSI and COMMAND should alternate between
      // PARAMETER and PARAMETER_SEP
      for (let i = 2; i < tokens.length - 1; i++) {
        const token = tokens[i];
        if (i % 2 === 0 && token.type !== "PARAMETER") return false;
        if (i % 2 === 1 && token.type !== "PARAMETER_SEP") return false;
      }

      return true;
    }

    // Other commands just need to end with COMMAND token
    return lastToken.type === "COMMAND";
  }

  // DebugLogger.log("token", { token });
  // DebugLogger.logRaw(token.raw);

  *parse(input: string): Generator<ParsedCommand> {
    const tokens = this.lexer.tokenize(input);
    let currentCommand: Partial<ParsedCommand> | null =
      this.incompleteCommand?.command || null;
    let textBuffer = "";
    this.tokenBuffer = this.incompleteCommand?.tokens || [];
    this.debugTokenBuffer = [];

    // DebugLogger.log("Starting parse with input", { input });
    // DebugLogger.log("Current incomplete command", {
    //   command: this.incompleteCommand?.command,
    //   tokens: this.tokenBuffer,
    // });

    this.incompleteCommand = null;

    for (const token of tokens) {
      this.debugTokenBuffer.push(token);
      this.tokenBuffer.push(token);
      // DebugLogger.log("", token);
      // DebugLogger.log("Processing token", {
      //   token,
      //   currentCommand,
      //   tokenBuffer: this.tokenBuffer,
      // });

      if (textBuffer && token.type !== "TEXT") {
        yield {
          type: "TEXT",
          action: "print",
          params: [],
          text: textBuffer,
          raw: textBuffer,
        };
        textBuffer = "";
      }

      switch (token.type) {
        case "TEXT":
          if (this.isDCSSequence) {
            this.dcsBuffer += token.value;
          } else {
            if (!currentCommand) {
              textBuffer += token.value;
            }
          }
          break;

        case "CONTROL":
        case "ST": // Handle ST (String Terminator) token
          if (
            (token.value === "\x07" || token.type === "ST") &&
            currentCommand?.type === "OSC"
          ) {
            if (currentCommand) {
              yield {
                type: "OSC",
                action: "osc",
                params: currentCommand.params || [],
                text: currentCommand.text || "",
                raw: (currentCommand.raw || "") + token.raw,
              };
              currentCommand = null;
            }
          } else if (token.type === "CONTROL") {
            yield {
              type: "CONTROL",
              action: this.getControlAction(token.value),
              params: [],
              raw: token.raw,
            };
          }
          break;

        case "ESC":
          currentCommand = {
            type: "UNKNOWN",
            action: "unknown",
            params: [],
            raw: token.raw,
          };
          break;

        case "OSC":
          if (currentCommand) {
            currentCommand.type = "OSC";
            currentCommand.action = "osc";
            currentCommand.raw = (currentCommand.raw || "") + token.raw;
          }
          break;

        case "CSI":
          if (currentCommand) {
            currentCommand.raw = (currentCommand.raw || "") + token.raw;
          }
          break;

        case "QUESTION":
          if (currentCommand) {
            this.isPrivateMode = true;
            currentCommand.private = true;
            currentCommand.raw = (currentCommand.raw || "") + token.raw;
          }
          break;

        case "PARAMETER":
          if (currentCommand) {
            // For OSC commands, only take the first parameter before the semicolon
            if (
              currentCommand.type === "OSC" &&
              currentCommand.params?.length === 0
            ) {
              currentCommand.params = [parseInt(token.value, 10)];
            } else {
              currentCommand.params = [
                ...(currentCommand.params || []),
                parseInt(token.value, 10),
              ];
            }
            currentCommand.raw = (currentCommand.raw || "") + token.raw;
          }
          break;

        case "PARAMETER_SEP":
          if (currentCommand) {
            currentCommand.raw = (currentCommand.raw || "") + token.raw;
          }
          break;

        case "STRING":
          if (currentCommand && currentCommand.type === "OSC") {
            const [paramStr, ...textParts] = token.value.split(";");
            const param = parseInt(paramStr, 10);

            if (!isNaN(param)) {
              currentCommand.params = [param];
              currentCommand.text = textParts.join(";");
            }
            currentCommand.raw = (currentCommand.raw || "") + token.raw;
          }
          break;

        case "COMMAND":
          if (token.value === "P" && currentCommand?.type === "UNKNOWN") {
            currentCommand.type = "DCS";
            this.isDCSSequence = true;
            this.dcsBuffer = "";
          } else if (token.value === "\\" && this.isDCSSequence) {
            yield {
              type: "DCS",
              action: "deviceControl",
              params: [],
              text: this.dcsBuffer,
              raw: currentCommand
                ? (currentCommand.raw || "") + token.raw
                : token.raw,
            };
            this.isDCSSequence = false;
            currentCommand = null;
          } else {
            if (currentCommand) {
              const command = this.parseCommand(
                currentCommand,
                token.value,
                token.raw
              );
              if (command) {
                yield command;
              }
              currentCommand = null;
            }
          }
          break;
      }
    }

    if (textBuffer) {
      yield {
        type: "TEXT",
        action: "print",
        params: [],
        text: textBuffer,
        raw: textBuffer,
      };
    }

    if (currentCommand) {
      if (this.isCompleteCommand(currentCommand, this.tokenBuffer)) {
        if (currentCommand.type === "OSC") {
          yield {
            type: "OSC",
            action: "osc",
            params: currentCommand.params || [],
            text: currentCommand.text || "",
            raw: currentCommand.raw || "",
          };
        } else {
          const command = this.parseCommand(currentCommand, "", "");
          if (command) {
            yield command;
          }
        }
        this.incompleteCommand = null;
      } else {
        this.incompleteCommand = {
          command: currentCommand,
          tokens: this.tokenBuffer,
        };
      }
    }
  }

  private parseCommand(
    command: Partial<ParsedCommand>,
    commandChar: string,
    rawCommandChar: string
  ): ParsedCommand {
    const fullRaw = (command.raw || "") + rawCommandChar;
    const params = command.params || [];

    // Check for CHARSET token in the token buffer
    const lastToken = this.tokenBuffer[this.tokenBuffer.length - 1];
    if (lastToken && lastToken.type === "CHARSET") {
      const [selector, charset] = lastToken.value.split("");
      return {
        type: "CHARSET",
        action: this.getCharsetAction(selector, charset),
        params: [],
        raw: fullRaw,
      };
    }

    // Handle DEC private commands
    if (commandChar === "7") {
      return {
        type: "CURSOR",
        action: "saveCursor",
        params: [],
        raw: fullRaw,
      };
    }
    if (commandChar === "8") {
      return {
        type: "CURSOR",
        action: "restoreCursor",
        params: [],
        raw: fullRaw,
      };
    }

    if (command.private) {
      return this.parsePrivateCommand(command, commandChar, rawCommandChar);
    }

    switch (commandChar) {
      // Style commands
      case "m":
        return {
          type: "SGR",
          action: "style",
          params: params.length ? params : [0],
          raw: fullRaw,
        };

      // Cursor commands
      case "A": // Cursor Up
      case "B": // Cursor Down
      case "C": // Cursor Forward
      case "D": // Cursor Back
      case "E": // Cursor Next Line
      case "F": // Cursor Previous Line
      case "G": // Cursor Horizontal Absolute
      case "H": // Cursor Position
        return {
          type: "CURSOR",
          action: this.getCursorAction(commandChar),
          params: params.length ? params : [1],
          raw: fullRaw,
        };

      // Screen commands
      case "J": // Clear screen
      case "K": // Clear line
        return {
          type: "CLEAR",
          action: this.getClearAction(commandChar),
          params: params.length ? params : [0],
          raw: fullRaw,
        };
      case "L": // Insert Lines
      case "M": // Delete Lines
      case "P": // Delete Characters
        return {
          type: "LINE_EDIT",
          action: this.getLineEditAction(commandChar),
          params: params.length ? params : [1], // Default to 1 if no parameter
          raw: fullRaw,
        };
      case "c": // Device Attributes
        return {
          type: "DEVICE",
          action:
            params.length === 0 ? "primaryDA" : `deviceAttributes${params[0]}`,
          params: params,
          raw: fullRaw,
        };
      case "r":
        return {
          type: "MARGIN", // or you could create a new "MARGIN" type if you prefer
          action: "setScrollRegion",
          params: params.length >= 2 ? params : [1],
          raw: fullRaw,
        };

      case "h":
      case "l":
        // If it's private mode, it's already handled
        if (command.private) {
          return this.parsePrivateCommand(command, commandChar, rawCommandChar);
        }
        // Handle non-private mode commands
        const isSet = commandChar === "h";
        const mode = isSet ? "set" : "reset";
        return {
          type: "PRIVATE_MODE",
          action: this.getNonPrivateModeAction(params[0], isSet),
          params,
          private: false,
          raw: fullRaw,
        };
      case "n": // Device Status Report
        return {
          type: "STATUS",
          action: this.getStatusReportAction(params[0]),
          params,
          raw: fullRaw,
        };
      case "t": // Window manipulation
        return {
          type: "WINDOW",
          action: this.getWindowAction(params),
          params,
          raw: fullRaw,
        };
      default:
        return {
          type: "UNKNOWN",
          action: `unknown_${commandChar}`,
          params: params,
          raw: fullRaw,
        };
    }
  }

  private getStatusReportAction(param: number): string {
    switch (param) {
      case 5:
        return "deviceStatus"; // Request device status
      case 6:
        return "cursorPosition"; // Request cursor position
      default:
        return `unknownStatusReport${param}`;
    }
  }

  private getWindowAction(params: number[]): string {
    const op = params[0];

    switch (op) {
      case 1:
        return "deiconify"; // De-iconify window
      case 2:
        return "iconify"; // Iconify window
      case 3:
        return "moveWindow"; // Move window to [x, y]
      case 4:
        return "resizePixels"; // Resize window in pixels
      case 5:
        return "moveToFront"; // Move window to front
      case 6:
        return "moveToBack"; // Move window to back
      case 7:
        return "refreshWindow"; // Refresh window
      case 8:
        return "resizeChars"; // Resize window in characters
      case 9:
        return "maximizeWindow"; // Maximize/restore window
      case 11:
        return "reportWindowState"; // Report window state
      case 13:
        return "reportWindowPosition"; // Report window position
      case 14:
        return "reportWindowPixels"; // Report window size in pixels
      case 18:
        return "reportWindowChars"; // Report window size in chars
      case 19:
        return "reportScreenChars"; // Report screen size in chars
      case 20:
        return "reportIconTitle"; // Report icon title
      case 21:
        return "reportWindowTitle"; // Report window title
      case 22:
        return params[1] === 0
          ? "saveWindowTitle"
          : params[1] === 1
          ? "saveIconTitle"
          : params[1] === 2
          ? "saveWindowAndIconTitle"
          : "unknown";
      case 23:
        return params[1] === 0
          ? "restoreWindowTitle"
          : params[1] === 1
          ? "restoreIconTitle"
          : params[1] === 2
          ? "restoreWindowAndIconTitle"
          : "unknown";
      default:
        return `unknownWindowOp${op}`;
    }
  }

  private getLineEditAction(command: string): string {
    const actions: Record<string, string> = {
      L: "insertLines",
      M: "deleteLines",
      P: "deleteChars",
    };
    return actions[command] || "unknown";
  }

  private getNonPrivateModeAction(param: number, isSet: boolean): string {
    const mode = isSet ? "set" : "reset";

    switch (param) {
      case 4:
        return `${mode}InsertMode`; // Insert/Replace mode
      case 20:
        return `${mode}LineFeed`; // Automatic newline mode
      // Add other non-private mode parameters as needed
      default:
        return `${mode}Unknown${param}`;
    }
  }

  private getCharsetAction(selector: string, charset: string): string {
    const setName =
      {
        "(": "G0",
        ")": "G1",
        "*": "G2",
        "+": "G3",
      }[selector] || "unknown";

    const charsetName =
      {
        "0": "Special",
        B: "ASCII",
        "1": "AlternateGraphics",
        "2": "AlternateSpecial",
      }[charset] || "unknown";

    return `setCharset_${setName}_${charsetName}`;
  }

  private parsePrivateCommand(
    command: Partial<ParsedCommand>,
    commandChar: string,
    rawCommandChar: string
  ): ParsedCommand {
    const params = command.params || [];
    const fullRaw = (command.raw || "") + rawCommandChar;

    // Handle both 'h' and 'h=' as the same command when in private mode
    if (commandChar === "h" || commandChar === "h=") {
      const action = this.getPrivateModeAction(params[0], true);
      return {
        type: "PRIVATE_MODE",
        action,
        params,
        private: true,
        raw: fullRaw,
      };
    }

    if (commandChar === "l") {
      const resetAction = this.getPrivateModeAction(params[0], false);
      return {
        type: "PRIVATE_MODE",
        action: resetAction,
        params,
        private: true,
        raw: fullRaw,
      };
    }

    return {
      type: "UNKNOWN",
      action: `unknown_private_${commandChar}`,
      params,
      private: true,
      raw: fullRaw,
    };
  }

  private getPrivateModeAction(param: number, isSet: boolean): string {
    const mode = isSet ? "set" : "reset";

    switch (param) {
      case 1:
        return `${mode}CursorKeys`; // Application Cursor Keys
      case 2:
        return `${mode}ANSI`; // ANSI/VT52 mode
      case 3:
        return `${mode}ColumnMode`; // 80/132 column mode
      case 4:
        return `${mode}SmoothScroll`; // Smooth scroll
      case 5:
        return `${mode}ReverseVideo`; // Reverse video
      case 6:
        return `${mode}Origin`; // Origin mode
      case 7:
        return `${mode}AutoWrap`; // Auto-wrap mode
      case 8:
        return `${mode}AutoRepeat`; // Auto-repeat keys
      case 9:
        return `${mode}InterlacingMode`; // Interlacing mode
      case 12:
        return `${mode}CursorBlink`; // Start blinking cursor
      case 25:
        return `${mode}ShowCursor`; // Show cursor
      case 1000:
        return `${mode}MouseClick`; // Send mouse X/Y on button press and release
      case 1002:
        return `${mode}MouseDrag`; // Use Cell Motion Mouse Tracking
      case 1003:
        return `${mode}MouseTrack`; // Use All Motion Mouse Tracking
      case 1004:
        return `${mode}FocusReport`; // Send FocusIn/FocusOut events
      case 1005:
        return `${mode}UTF8Mouse`; // Enable UTF-8 Mouse Mode
      case 1006:
        return `${mode}SGRMouse`; // Enable SGR Mouse Mode
      case 1015:
        return `${mode}UrxvtMouse`; // Enable urxvt Mouse Mode
      case 1047:
        return `${mode}AltScreen`; // Use Alternate Screen Buffer
      case 1048:
        return `${mode}SaveCursor`; // Save cursor as in DECSC
      case 1049:
        return `${mode}AltScreenAndCursor`; // Save cursor and use Alternate Screen Buffer
      case 2004:
        return `${mode}BracketedPaste`; // Enable bracketed paste mode
      default:
        return `${mode}Unknown${param}`;
    }
  }

  private getCursorAction(command: string): string {
    const actions: Record<string, string> = {
      A: "up",
      B: "down",
      C: "forward",
      D: "back",
      E: "nextLine",
      F: "prevLine",
      G: "horizontalAbsolute",
      H: "position",
    };
    return actions[command] || "unknown";
  }

  private getClearAction(command: string): string {
    const actions: Record<string, string> = {
      J: "screen",
      K: "line",
    };
    return actions[command] || "unknown";
  }

  private getControlAction(controlChar: string): string {
    const controls: Record<string, string> = {
      "\r": "carriageReturn",
      "\n": "lineFeed",
      "\t": "tab",
      "\b": "backspace",
      "\f": "formFeed",
      "\v": "verticalTab",
      "\x07": "bell",
    };
    return controls[controlChar] || "unknown";
  }

  getTokenBuffer(): Token[] {
    return this.debugTokenBuffer;
  }
}
