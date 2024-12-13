import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";

// Enum for common simple escape sequences final bytes
// This helps with type checking and documentation
export enum SimpleEscapeCommand {
  // Existing commands
  RIS = "c",     // Reset to Initial State
  DECSC = "7",   // Save Cursor
  DECRC = "8",   // Restore Cursor
  IND = "D",     // Index
  NEL = "E",     // Next Line
  HTS = "H",     // Horizontal Tab Set
  RI = "M",      // Reverse Index
  SS2 = "N",     // Single Shift 2
  SS3 = "O",     // Single Shift 3
  DECPAM = "=",  // Application Keypad Mode
  DECPNM = ">",  // Normal Keypad Mode

  // Additional commands
  DECALN = "8",  // Screen Alignment Pattern (Fill screen with Es)
  DECKPAM = "=", // Keypad Application Mode
  DECKPNM = ">", // Keypad Numeric Mode

  // Tab control
  DECTBC = "0",  // Clear Tab at Current Position
  DECSWL = "3",  // Single-width Line
  DECDWL = "4",  // Double-width Line
  DECHDL = "3",  // Double-height Line (top half)
  DECHDBL = "4", // Double-height Line (bottom half)

  // Character set selection
  SCS0 = "(",    // Select Character Set G0
  SCS1 = ")",    // Select Character Set G1
  SCS2 = "*",    // Select Character Set G2
  SCS3 = "+",    // Select Character Set G3

  // Memory operations
  DECBI = "6",   // Back Index
  DECFI = "9",   // Forward Index

  // Line feed mode
  DECNM = "~",   // Normal Mode (versus Application Mode)

  // VT52 compatibility mode
  DECVT52 = "<", // Enter VT52 Mode
}

export class SimpleEscapeSequence extends VT100Sequence {
  constructor(raw: Uint8Array, public readonly finalByte: number) {
    super(SequenceType.ESCAPE, ControlCharacter.ESC, raw);
  }

  isValid(): boolean {
    // For simple escape sequences, the final byte must be:
    // 1. A valid command character (0x30-0x7E)
    // 2. Not a CSI, OSC, or other control introducer

    const invalidFollowers = [
      "[", // CSI
      "]", // OSC
      "P", // DCS
      "^", // PM
      "_", // APC
      "%", // Character Set Selection
      "#", // Line Size Command
      "(", // G0 Character Set
      ")", // G1 Character Set
      "*", // G2 Character Set
      "+", // G3 Character Set
    ];

    const finalChar = String.fromCharCode(this.finalByte);

    return (
      this.finalByte >= 0x30 &&
      this.finalByte <= 0x7e &&
      !invalidFollowers.includes(finalChar)
    );
  }

  toString(): string {
    return `\x1B${String.fromCharCode(this.finalByte)}`;
  }

  // Helper method to get the command type if it's a known command
  getCommandType(): SimpleEscapeCommand | null {
    const finalChar = String.fromCharCode(this.finalByte);
    return Object.values(SimpleEscapeCommand).includes(
      finalChar as SimpleEscapeCommand
    )
      ? (finalChar as SimpleEscapeCommand)
      : null;
  }

  // Static helper to create common sequences
  static create(command: SimpleEscapeCommand): SimpleEscapeSequence {
    return new SimpleEscapeSequence(
      new Uint8Array([ControlCharacter.ESC, command.charCodeAt(0)]),
      command.charCodeAt(0)
    );
  }

  // Create from raw bytes
  static from(bytes: Uint8Array): SimpleEscapeSequence {
    if (bytes.length < 2) {
      throw new Error("Invalid Simple Escape sequence: too short");
    }

    if (bytes[0] !== ControlCharacter.ESC) {
      throw new Error("Invalid Simple Escape sequence: must start with ESC");
    }

    // For simple escape sequences, the second byte is the final byte
    const finalByte = bytes[1];

    // Create new instance
    const sequence = new SimpleEscapeSequence(bytes, finalByte);

    if (!sequence.isValid()) {
      throw new Error("Invalid Simple Escape sequence: validation failed");
    }

    return sequence;
  }

  // Create from string representation
  static fromStr(text: string): SimpleEscapeSequence {
    // Verify the string starts with ESC
    if (!text.startsWith("\x1B")) {
      throw new Error(
        "Invalid Simple Escape sequence string: must start with ESC"
      );
    }

    // For simple escape sequences, we expect exactly two characters: ESC + final byte
    if (text.length !== 2) {
      throw new Error(
        "Invalid Simple Escape sequence string: incorrect length"
      );
    }

    // Convert to bytes
    const bytes = new Uint8Array([ControlCharacter.ESC, text.charCodeAt(1)]);

    return this.from(bytes);
  }
}
