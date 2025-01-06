import { ANSISequence } from "../Command.js";
import {
  CSISequence,
  SGRColor,
  SGRAttribute,
  CSICommand,
} from "../CSISequence.js";
import { OSCSequence, OSCCommand } from "../OSCSequence.js";
import { VT100Formatter } from "../VT100Formatter.js";
import { TextSequence } from "../TextSequence.js";
import { BaseTerminalPanel } from "./BaseTerminalPanel.js";
import {
  SimpleEscapeCommand,
  SimpleEscapeSequence,
} from "../SimpleEscapeSequence.js";
import { Cell } from "./interfaces.js";
import { C0Sequence, C0Command } from "../ControlSequence.js";
import {
  CharsetSequence,
  CharacterSet,
  CharsetDesignator,
} from "../CharsetSequence.js";
// import { DebugLogger } from "../DebugLogger.js";

export interface TextStyle {
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  inverse?: boolean;
  hidden?: boolean;
  strikethrough?: boolean;
  color?: SGRColor | { r: number; g: number; b: number } | number; // SGR color, RGB, or 256-color
  backgroundColor?: SGRColor | { r: number; g: number; b: number } | number;
}

export interface ModeState {
  applicationCursor: boolean;
  applicationKeypad: boolean;
  wrap: boolean;
  insert: boolean;
  originMode: boolean;
  autoWrap: boolean;
  bracketedPaste: boolean;
  mouseTracking: boolean;
}

// Define a type for the charset slots
type CharsetSlot = "g0" | "g1" | "g2" | "g3";

// Define the interface for the activeCharsets object
interface ActiveCharsets {
  g0: CharacterSet;
  g1: CharacterSet;
  g2: CharacterSet;
  g3: CharacterSet;
  current: CharsetSlot;
}

export class BufferManager {
  private style: TextStyle = {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    hidden: false,
    strikethrough: false,
    color: undefined,
    backgroundColor: undefined,
  };

  private mode: ModeState = {
    applicationCursor: false,
    applicationKeypad: false,
    wrap: true,
    insert: false,
    originMode: false,
    autoWrap: true,
    bracketedPaste: false,
    mouseTracking: false,
  };

  constructor(private terminal: BaseTerminalPanel) {}

  private activeCharsets: ActiveCharsets = {
    g0: CharacterSet.USASCII, // Default G0 is US ASCII
    g1: CharacterSet.USASCII, // Default G1 is US ASCII
    g2: CharacterSet.USASCII, // Default G2 is US ASCII
    g3: CharacterSet.USASCII, // Default G3 is US ASCII
    current: "g0", // Current active charset (default to G0)
  };

  handleSequence(sequence: ANSISequence) {
    if (sequence instanceof CSISequence) {
      return this.handleCSI(sequence);
    }

    if (sequence instanceof OSCSequence) {
      return this.handleOSC(sequence);
    }

    if (sequence instanceof TextSequence) {
      return this.handleText(sequence);
    }

    if (sequence instanceof C0Sequence) {
      return this.handleC0(sequence);
    }

    if (sequence instanceof SimpleEscapeSequence) {
      return this.handleSimpleEscape(sequence);
    }

    if (sequence instanceof CharsetSequence) {
      return this.handleCharset(sequence);
    }

    if (sequence instanceof SimpleEscapeSequence) {
      const command = sequence.getCommandType();
      if (command === SimpleEscapeCommand.DECKPAM) {
        return this.setKeypadMode(true); // DECKPAM enables it
      } else if (command === SimpleEscapeCommand.DECKPNM) {
        return this.setKeypadMode(false); // DECKPNM disables it
      }
    }

    throw new Error(
      `Sequence not implemented ${VT100Formatter.format(sequence)}`
    );
  }

  private handleCharset(sequence: CharsetSequence) {
    if (!sequence.isValid()) {
      throw new Error(`Invalid charset sequence: ${sequence.toString()}`);
    }

    // Determine which character set slot we're modifying
    let charsetSlot: "g0" | "g1" | "g2" | "g3";
    switch (sequence.designator) {
      case CharsetDesignator.G0:
        charsetSlot = "g0";
        break;
      case CharsetDesignator.G1:
        charsetSlot = "g1";
        break;
      case CharsetDesignator.G2:
        charsetSlot = "g2";
        break;
      case CharsetDesignator.G3:
        charsetSlot = "g3";
        break;
      default:
        throw new Error(`Unknown charset designator: ${sequence.designator}`);
    }

    // Get the charset type
    const charsetType = sequence.getCharsetType();
    if (charsetType === null) {
      console.warn(
        `Unsupported charset: ${String.fromCharCode(sequence.charset)}`
      );
      return;
    }

    // Set the active charset for the specified slot
    this.activeCharsets[charsetSlot] = charsetType;
  }

  public handleShiftIn() {
    this.activeCharsets.current = "g0";
  }

  public handleShiftOut() {
    this.activeCharsets.current = "g1";
  }

  private handleSimpleEscape(sequence: SimpleEscapeSequence) {
    const command = sequence.getCommandType();

    if (!command) {
      throw new Error(`Unknown Simple Escape sequence: ${sequence.toString()}`);
    }

    switch (command) {
      case SimpleEscapeCommand.RIS: // Reset to Initial State
        // this.terminal.reset();
        break;

      case SimpleEscapeCommand.DECSC: // Save Cursor
      case SimpleEscapeCommand.SCOSC: // Save Cursor (alternative)
        this.terminal.saveCursorPosition();
        break;

      case SimpleEscapeCommand.DECRC: // Restore Cursor
      case SimpleEscapeCommand.SCORC: // Restore Cursor (alternative)
        this.terminal.restoreCursorPosition();
        break;

      case SimpleEscapeCommand.IND: // Index (move cursor down)
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row + 1, pos.col);
        break;

      case SimpleEscapeCommand.NEL: // Next Line
        this.terminal.handleNewline();
        this.terminal.handleCarriageReturn();
        break;

      case SimpleEscapeCommand.HTS: // Horizontal Tab Set
        this.terminal.setTabStop();
        break;

      case SimpleEscapeCommand.RI: // Reverse Index (move cursor up)
        const curPos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(curPos.row - 1, curPos.col);
        break;

      case SimpleEscapeCommand.DECPAM: // Application Keypad Mode
      case SimpleEscapeCommand.DECKPAM:
        this.setKeypadMode(true);
        break;

      case SimpleEscapeCommand.DECPNM: // Normal Keypad Mode
      case SimpleEscapeCommand.DECKPNM:
        this.setKeypadMode(false);
        break;

      case SimpleEscapeCommand.DECALN: // Screen Alignment Pattern
        this.terminal.beginBatchUpdate();
        const { rows, cols } = this.terminal.dimensions;

        // Fill screen with 'E' characters
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            this.terminal.writeCells([
              {
                char: "E",
                attributes: {},
                isDirty: true,
              },
            ]);
          }
          // Move to start of next line unless we're on the last line
          if (row < rows - 1) {
            this.terminal.moveCursorTo(row + 1, 0);
          }
        }
        this.terminal.endBatchUpdate();
        break;

      // Character set selection - these might need additional implementation
      case SimpleEscapeCommand.SCS0:
      case SimpleEscapeCommand.SCS1:
      case SimpleEscapeCommand.SCS2:
      case SimpleEscapeCommand.SCS3:
        // TODO: Implement character set selection if needed
        break;

      case SimpleEscapeCommand.DECBI: // Back Index
        const currentPos = this.terminal.getCursorPosition();
        if (currentPos.col > 0) {
          this.terminal.moveCursorTo(currentPos.row, currentPos.col - 1);
        }
        break;

      case SimpleEscapeCommand.DECFI: // Forward Index
        const currPos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(currPos.row, currPos.col + 1);
        break;

      // Less commonly used commands that might need implementation
      case SimpleEscapeCommand.SS2: // Single Shift 2
      case SimpleEscapeCommand.SS3: // Single Shift 3
      case SimpleEscapeCommand.DECNM: // Normal Mode
      case SimpleEscapeCommand.DECVT52: // VT52 Mode
      case SimpleEscapeCommand.DECTBC: // Clear Tab
      case SimpleEscapeCommand.DECSWL: // Single-width Line
      case SimpleEscapeCommand.DECDWL: // Double-width Line
      case SimpleEscapeCommand.DECHDL: // Double-height Line (top)
      case SimpleEscapeCommand.DECHDBL: // Double-height Line (bottom)
        // TODO: Implement these less common commands if needed
        console.warn(`Unimplemented Simple Escape command: ${command}`);
        break;

      default:
        throw new Error(`Simple Escape command not implemented: ${command}`);
    }
  }

  private handleCSI(sequence: CSISequence) {
    // Cursor Commands
    if (CSISequence.isCursorCommand(sequence)) {
      return this.handleCursor(sequence);
    }

    // Screen Commands
    if (CSISequence.isScreenCommand(sequence)) {
      return this.handleScreen(sequence);
    }

    // Erase Commands
    if (CSISequence.isEraseCommand(sequence)) {
      return this.handleErase(sequence);
    }

    // Mode Commands
    if (CSISequence.isModeCommand(sequence)) {
      return this.handleMode(sequence);
    }

    // SGR Commands
    if (CSISequence.isSgrCommand(sequence)) {
      return this.handleSgr(sequence);
    }

    // Window Commands
    if (CSISequence.isWindowCommand(sequence)) {
      return this.handleWindow(sequence);
    }

    // Insert/Delete Commands
    if (CSISequence.isInsertDeleteCommand(sequence)) {
      return this.handleInsertDelete(sequence);
    }

    throw new Error(`CSI Sequence not handled ${sequence.toString()}`);
  }

  private handleOSC(sequence: OSCSequence) {
    const { command, args } = sequence.getCommand();
    if (command == OSCCommand.SET_ICON_NAME_AND_WINDOW_TITLE) {
      this.terminal.setWindowTitle(args[0] || "");
      this.terminal.setIconName(args[0] || "");
      return;
    }

    if (command == OSCCommand.SET_WINDOW_TITLE) {
      return this.terminal.setWindowTitle(args[0] || "");
    }

    if (command == OSCCommand.SET_ICON_NAME) {
      return this.terminal.setIconName(args[0] || "");
    }

    if (command == OSCCommand.SET_CURRENT_DIR) {
      return this.terminal.setWorkingDir(args[0] || "");
    }

    throw new Error(`OSC Sequence not handled ${sequence.toString()}`);
  }

  private handleC0(sequence: C0Sequence) {
    const command = sequence.command;
    const repeat = sequence.repeat;

    switch (command) {
      case C0Command.NUL: // Null
        // Do nothing
        break;

      case C0Command.BEL: // Bell
        this.terminal.bell();
        break;

      case C0Command.BS: // Backspace
        for (let i = 0; i < repeat; i++) {
          this.terminal.handleBackspace();
        }
        break;

      case C0Command.HT: // Horizontal Tab
        for (let i = 0; i < repeat; i++) {
          this.terminal.handleTab();
        }
        break;

      case C0Command.LF: // Line Feed
        for (let i = 0; i < repeat; i++) {
          this.terminal.handleNewline();
        }
        break;

      case C0Command.VT: // Vertical Tab
        // Handle similarly to LF
        for (let i = 0; i < repeat; i++) {
          this.terminal.handleNewline();
        }
        break;

      case C0Command.FF: // Form Feed
        // Clear screen and move cursor to home position
        this.terminal.clearScreen("all");
        this.terminal.moveCursorTo(0, 0);
        break;

      case C0Command.CR: // Carriage Return
        this.terminal.handleCarriageReturn();
        break;

      case C0Command.SO: // Shift Out
        // TODO: Implement character set switching (switch to alternate character set)
        break;

      case C0Command.SI: // Shift In
        // TODO: Implement character set switching (switch to standard character set)
        break;

      case C0Command.CAN: // Cancel
        // TODO: Cancel escape sequence in progress
        break;

      case C0Command.SUB: // Substitute
        // TODO: Similar to CAN, cancel escape sequence and show error character
        break;

      case C0Command.ESC: // Escape
        // Handle standalone ESC character
        // This can occur when ESC is followed by an invalid sequence byte
        // No action needed - ESC by itself typically doesn't affect terminal state
        break;

      case C0Command.DEL: // Delete
        for (let i = 0; i < repeat; i++) {
          this.terminal.deleteCells(1);
        }
        break;

      // Less commonly used C0 controls
      case C0Command.SOH: // Start of Heading
      case C0Command.STX: // Start of Text
      case C0Command.ETX: // End of Text
      case C0Command.EOT: // End of Transmission
      case C0Command.ENQ: // Enquiry
      case C0Command.ACK: // Acknowledge
      case C0Command.DLE: // Data Link Escape
      case C0Command.DC1: // XON
      case C0Command.DC2: // Device Control 2
      case C0Command.DC3: // XOFF
      case C0Command.DC4: // Device Control 4
      case C0Command.NAK: // Negative Acknowledge
      case C0Command.SYN: // Synchronous Idle
      case C0Command.ETB: // End of Transmission Block
      case C0Command.EM: // End of Medium
      case C0Command.FS: // File Separator
      case C0Command.GS: // Group Separator
      case C0Command.RS: // Record Separator
      case C0Command.US: // Unit Separator
        // These control characters are typically ignored in modern terminal emulators
        break;

      default:
        throw new Error(`Unhandled C0 control character: ${command}`);
    }
  }

  private setKeypadMode(enabled: boolean) {
    this.mode.applicationKeypad = enabled;
  }

  private handleCursor(sequence: CSISequence) {
    const command = sequence.command;
    const params = sequence.parameters;

    switch (command) {
      case CSICommand.CUP: {
        // Cursor Position
        const row = (params[0]?.value ?? 1) - 1;
        const col = (params[1]?.value ?? 1) - 1;
        this.terminal.moveCursorTo(row, col);
        break;
      }
      case CSICommand.CUU: {
        // Cursor Up
        const count = params[0]?.value ?? 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row - count, pos.col);
        this.terminal.forceHasChanges();
        break;
      }
      case CSICommand.CUD: {
        // Cursor Down
        const count = params[0]?.value ?? 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row + count, pos.col);
        this.terminal.forceHasChanges();
        break;
      }
      case CSICommand.CUF: {
        // Cursor Forward
        const count = params[0]?.value ?? 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row, pos.col + count);
        this.terminal.forceHasChanges();
        break;
      }
      case CSICommand.CUB: {
        // Cursor Back
        const count = params[0]?.value ?? 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row, pos.col - count);
        this.terminal.forceHasChanges();
        break;
      }
      case CSICommand.CNL: {
        // Cursor Next Line
        const count = params[0]?.value ?? 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row + count, 0);
        this.terminal.forceHasChanges();
        break;
      }
      case CSICommand.CPL: {
        // Cursor Previous Line
        const count = params[0]?.value ?? 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row - count, 0);
        this.terminal.forceHasChanges();
        break;
      }
      case CSICommand.CHA: {
        // Cursor Horizontal Absolute
        const col = (params[0]?.value ?? 1) - 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(pos.row, col);
        break;
      }
      case CSICommand.VPA: {
        // Vertical Position Absolute
        const row = (params[0]?.value ?? 1) - 1;
        const pos = this.terminal.getCursorPosition();
        this.terminal.moveCursorTo(row, pos.col);
        break;
      }
      case CSICommand.CHT: {
        // Cursor Forward Tabulation
        const count = params[0]?.value ?? 1;
        for (let i = 0; i < count; i++) {
          this.terminal.handleTab();
        }
        break;
      }
      case CSICommand.CBT: {
        // Cursor Backward Tabulation
        const count = params[0]?.value ?? 1;
        // TODO: Implement backward tabulation when terminal supports it
        break;
      }
      case CSICommand.SCOSC: {
        // Save Cursor Position
        this.terminal.saveCursorPosition();
        break;
      }
      case CSICommand.SCORC: {
        // Restore Cursor Position
        this.terminal.restoreCursorPosition();
        break;
      }
      case CSICommand.DSR: {
        if (params[0]?.value === 6) {
          const pos = this.terminal.getCursorPosition();
          // Report format: ESC [ row ; col R
          const report = `\x1b[${pos.row + 1};${pos.col + 1}R`;
          this.terminal.emit("terminalResponse", report);
        }
        break;
      }
      default:
        throw new Error(`Cursor command not implemented: ${command}`);
    }
  }

  private handleSgr(sequence: CSISequence) {
    if (!sequence.parameters.length) {
      sequence.parameters.push({ value: 0, private: false });
    }
    for (const param of sequence.parameters) {
      const value = param.value;
      if (value === null) continue;

      switch (value) {
        // Reset
        case SGRAttribute.Reset:
          this.style = {
            bold: false,
            dim: false,
            italic: false,
            underline: false,
            blink: false,
            inverse: false,
            hidden: false,
            strikethrough: false,
            color: undefined,
            backgroundColor: undefined,
          };
          break;

        // Text attributes
        case SGRAttribute.Bold:
          this.style.bold = true;
          break;
        case SGRAttribute.Dim:
          this.style.dim = true;
          break;
        case SGRAttribute.Italic:
          this.style.italic = true;
          break;
        case SGRAttribute.Underline:
          this.style.underline = true;
          break;
        case SGRAttribute.BlinkSlow:
        case SGRAttribute.BlinkRapid:
          this.style.blink = true;
          break;
        case SGRAttribute.Inverse:
          this.style.inverse = true;
          break;
        case SGRAttribute.Hidden:
          this.style.hidden = true;
          break;
        case SGRAttribute.StrikeThrough:
          this.style.strikethrough = true;
          break;

        // Reset individual attributes
        case SGRAttribute.BoldOff:
          this.style.bold = false;
          this.style.dim = false;
          break;
        case SGRAttribute.ItalicOff:
          this.style.italic = false;
          break;
        case SGRAttribute.UnderlineOff:
          this.style.underline = false;
          break;
        case SGRAttribute.BlinkOff:
          this.style.blink = false;
          break;
        case SGRAttribute.InverseOff:
          this.style.inverse = false;
          break;
        case SGRAttribute.StrikeThroughOff:
          this.style.strikethrough = false;
          break;

        // Standard colors (30-37 foreground, 40-47 background)
        case SGRColor.Default:
          this.style.color = undefined;
          break;
        case SGRColor.BgDefault:
          this.style.backgroundColor = undefined;
          break;
        default:
          // Handle standard colors
          if (value >= SGRColor.Black && value <= SGRColor.White) {
            this.style.color = value;
          } else if (value >= SGRColor.BgBlack && value <= SGRColor.BgWhite) {
            this.style.backgroundColor = value;
          }
          // Handle bright colors
          else if (
            value >= SGRColor.BrightBlack &&
            value <= SGRColor.BrightWhite
          ) {
            this.style.color = value;
          } else if (
            value >= SGRColor.BgBrightBlack &&
            value <= SGRColor.BgBrightWhite
          ) {
            this.style.backgroundColor = value;
          }
          // Handle 256 colors and RGB colors
          else if (value === 38 || value === 48) {
            const isBackground = value === 48;
            const colorType =
              sequence.parameters[sequence.parameters.indexOf(param) + 1]
                ?.value;

            if (colorType === 5) {
              // 256 color mode
              const colorCode =
                sequence.parameters[sequence.parameters.indexOf(param) + 2]
                  ?.value;
              if (colorCode !== undefined) {
                if (isBackground) {
                  if (typeof colorCode === "number") {
                    this.style.backgroundColor = colorCode;
                  }
                } else {
                  if (typeof colorCode === "number") {
                    this.style.color = colorCode;
                  }
                }
              }
            } else if (colorType === 2) {
              // RGB color mode
              // Extract the values and ensure they're numbers
              const rValue =
                sequence.parameters[sequence.parameters.indexOf(param) + 2]
                  ?.value;
              const gValue =
                sequence.parameters[sequence.parameters.indexOf(param) + 3]
                  ?.value;
              const bValue =
                sequence.parameters[sequence.parameters.indexOf(param) + 4]
                  ?.value;

              if (
                typeof rValue === "number" &&
                typeof gValue === "number" &&
                typeof bValue === "number"
              ) {
                const rgb = { r: rValue, g: gValue, b: bValue };
                if (isBackground) {
                  this.style.backgroundColor = rgb;
                } else {
                  this.style.color = rgb;
                }
              }
            }
          }
      }
    }
  }

  private handleMode(sequence: CSISequence) {
    const isSet = sequence.command === CSICommand.SM;
    const isReset = sequence.command === CSICommand.RM;
    const isPrivate = sequence.parameters.some((p) => p.private);

    for (const param of sequence.parameters) {
      if (param.value === null) continue;

      // Handle ANSI modes
      if (!param.private) {
        switch (param.value) {
          case 4: // Insert Mode
            this.mode.insert = isSet;
            break;
          case 20: // Line Feed/New Line Mode
            this.mode.autoWrap = isSet;
            break;
        }
      }
      // Handle DEC private modes
      else {
        switch (param.value) {
          case 1: // Application Cursor Keys
            this.mode.applicationCursor = isSet;
            break;
          case 6: // Origin Mode
            this.mode.originMode = isSet;
            break;
          case 7: // Auto-wrap Mode
            this.mode.wrap = isSet;
            break;
          case 66: // Application Keypad Mode
            this.setKeypadMode(isSet);
            break;
          case 1000: // Mouse Tracking
          case 1002: // Mouse Button Events
          case 1003: // Mouse Any Event
            this.mode.mouseTracking = isSet;
            break;
          case 2004: // Bracketed Paste Mode
            this.mode.bracketedPaste = isSet;
            break;
        }
      }
    }

    // Notify terminal of mode changes
    // if (this.terminal.onModeChange) {
    //   this.terminal.onModeChange(this.mode);
    // }
  }

  private handleScreen(sequence: CSISequence) {
    const command = sequence.command;
    const params = sequence.parameters;

    switch (command) {
      case CSICommand.SU: // Scroll Up
        const upLines = params[0]?.value ?? 1;
        this.terminal.scrollUp(upLines);
        break;

      case CSICommand.SD: // Scroll Down
        const downLines = params[0]?.value ?? 1;
        this.terminal.scrollDown(downLines);
        break;

      case CSICommand.DECSTBM: {
        // Set Scrolling Region [top;bottom]
        const dimensions = this.terminal.dimensions;
        // Convert 1-based to 0-based indexing
        const top = Math.max(
          0,
          Math.min((params[0]?.value ?? 1) - 1, dimensions.rows - 1)
        );
        // If bottom is not specified, use the last row
        const bottom = params[1]?.value
          ? Math.max(
              top + 1,
              Math.min(params[1].value - 1, dimensions.rows - 1)
            )
          : dimensions.rows - 1;

        this.terminal.setScrollRegion(top, bottom);

        // DECSTBM moves the cursor to column 0, line 0
        this.terminal.moveCursorTo(0, 0);
        break;
      }

      case CSICommand.DECSLRM: {
        // Set Left and Right Margins
        const dimensions = this.terminal.dimensions;
        const left = Math.max(
          0,
          Math.min((params[0]?.value ?? 1) - 1, dimensions.cols - 1)
        );
        const right = params[1]?.value
          ? Math.max(left + 1, Math.min(params[1].value, dimensions.cols))
          : dimensions.cols;

        // Similar to DECSTBM, we'll emit these as custom events
        this.terminal.emit("setMargins", { left, right });
        break;
      }

      case CSICommand.DECALN: {
        // Screen Alignment Pattern (Fill screen with 'E')
        this.terminal.beginBatchUpdate();
        const { rows, cols } = this.terminal.dimensions;

        // Fill entire screen with 'E' characters
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            this.terminal.writeCells([
              {
                char: "E",
                attributes: {},
                isDirty: true,
              },
            ]);
          }

          // Move to the start of the next line, unless we're on the last line
          if (row < rows - 1) {
            this.terminal.moveCursorTo(row + 1, 0);
          }
        }
        this.terminal.endBatchUpdate();
        break;
      }

      default:
        throw new Error(`Screen command not implemented: ${command}`);
    }
  }

  private handleWindow(sequence: CSISequence) {
    if (sequence.command === CSICommand.XTWINOPS) {
      const operation = sequence.parameters[0]?.value;
      const p1 = sequence.parameters[1]?.value;
      const p2 = sequence.parameters[2]?.value;

      switch (operation) {
        case 1: // De-iconify window
        case 2: // Iconify window
          this.terminal.emit("windowOp", { op: operation });
          break;

        case 3: // Move window
          if (typeof p1 === "number" && typeof p2 === "number") {
            this.terminal.emit("windowOp", { op: operation, x: p1, y: p2 });
          }
          break;

        case 4: // Resize window (pixels)
          if (typeof p1 === "number" && typeof p2 === "number") {
            this.terminal.emit("windowOp", {
              op: operation,
              width: p1,
              height: p2,
            });
          }
          break;

        case 8: // Resize window (chars)
          if (typeof p1 === "number" && typeof p2 === "number") {
            this.terminal.resize({ rows: p1, cols: p2 });
          }
          break;

        case 9: // Maximize/Restore window
          this.terminal.emit("windowOp", { op: operation, state: p1 });
          break;

        case 13: // Report window position
        case 14: // Report window size (pixels)
        case 18: // Report window size (chars)
          this.terminal.emit("windowReport", { query: operation });
          break;

        case 22: // Save window size & position
        case 23: // Restore window size & position
          this.terminal.emit("windowOp", { op: operation });
          break;
      }
    }
  }

  private handleInsertDelete(sequence: CSISequence) {
    const command = sequence.command;
    const params = sequence.parameters;
    const count = params[0]?.value ?? 1;

    switch (command) {
      case CSICommand.DCH: // Delete Character
        // Implementation exists in handleErase
        return this.handleErase(sequence);

      case CSICommand.DL: // Delete Line
        // Delete 'count' lines starting at the current cursor row
        this.terminal.deleteLines(count);
        break;

      case CSICommand.ICH: // Insert Character
        // Insert 'count' blank characters at current cursor position
        this.terminal.insertCells(count);
        break;

      case CSICommand.IL: // Insert Line
        // Insert 'count' blank lines at current cursor row
        this.terminal.insertLines(count);
        break;

      default:
        throw new Error(`Insert/Delete command not implemented: ${command}`);
    }
  }

  private handleErase(sequence: CSISequence) {
    const command = sequence.command;
    const param = sequence.parameters[0]?.value ?? 0;

    switch (command) {
      case CSICommand.ED: // Erase in Display
        switch (param) {
          case 0: // From cursor to end of screen
            this.terminal.clearScreen("end");
            break;
          case 1: // From start of screen to cursor
            this.terminal.clearScreen("start");
            break;
          case 2: // Entire screen
            this.terminal.clearScreen("all");
            break;
          case 3: // Erase scrollback buffer (xterm)
            // this.terminal.clearScreen("scrollback");
            throw new Error("IMPLEMENT SCROLLBACK");
        }
        break;

      case CSICommand.EL: // Erase in Line
        switch (param) {
          case 0: // From cursor to end of line
            this.terminal.clearLine("end");
            break;
          case 1: // From start of line to cursor
            this.terminal.clearLine("start");
            break;
          case 2: // Entire line
            this.terminal.clearLine("all");
            break;
        }
        break;

      case CSICommand.DCH: // Erase Characters
        const count = Math.max(1, param);
        const pos = this.terminal.getCursorPosition();
        // Erase specified number of characters from current cursor position
        for (let i = 0; i < count; i++) {
          this.terminal.writeCells([
            {
              char: " ",
              attributes: {},
              isDirty: true,
            },
          ]);
        }
        // Reset cursor to original position
        this.terminal.moveCursorTo(pos.row, pos.col);
        break;
    }
  }

  private handleText(sequence: TextSequence) {
    const text = sequence.text;
    const operations: Array<{
      type: "cells" | "newline" | "carriageReturn" | "backspace";
      cells?: Cell[];
    }> = [];
    let currentCells: Cell[] = [];

    const flushCells = () => {
      if (currentCells.length > 0) {
        operations.push({ type: "cells", cells: currentCells });
        currentCells = [];
      }
    };

    const chars = Array.from(text);
    const currentSlot = this.activeCharsets.current;
    const currentCharset = this.activeCharsets[currentSlot];

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];

      // Handle CRLF sequence as a single operation
      if (char === "\r" && i + 1 < chars.length && chars[i + 1] === "\n") {
        flushCells();
        operations.push({ type: "newline" });
        operations.push({ type: "carriageReturn" });
        i++; // Skip the \n since we've handled it
        continue;
      }

      // Handle control characters
      if (char === "\r") {
        flushCells();
        operations.push({ type: "carriageReturn" });
        continue;
      }
      if (char === "\n") {
        flushCells();
        operations.push({ type: "newline" });
        continue;
      }
      if (char === "\b") {
        flushCells();
        operations.push({ type: "backspace" });
        continue;
      }

      // Create cell with current style
      currentCells.push({
        char,
        attributes: {
          bold: this.style.bold || false,
          dim: this.style.dim || false,
          italic: this.style.italic || false,
          underline: this.style.underline || false,
          blink: this.style.blink || false,
          inverse: this.style.inverse || false,
          hidden: this.style.hidden || false,
          strikethrough: this.style.strikethrough || false,
          color: this.style.color,
          backgroundColor: this.style.backgroundColor,
        },
        isDirty: true,
      });
    }

    // Flush any remaining cells
    flushCells();

    // Process all operations in order
    for (const operation of operations) {
      switch (operation.type) {
        case "cells":
          this.terminal.writeCells(operation.cells!, currentCharset);
          break;
        case "newline":
          this.terminal.handleNewline();
          break;
        case "carriageReturn":
          this.terminal.handleCarriageReturn();
          break;
        case "backspace":
          this.terminal.handleBackspace();
          break;
      }
    }
  }
}
