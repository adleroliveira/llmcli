import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";

// Enum for common simple escape sequences final bytes
// This helps with type checking and documentation
enum SimpleEscapeCommand {
  RIS = "c", // Reset to Initial State
  DECSC = "7", // Save Cursor
  DECRC = "8", // Restore Cursor
  IND = "D", // Index
  NEL = "E", // Next Line
  HTS = "H", // Horizontal Tab Set
  RI = "M", // Reverse Index
  SS2 = "N", // Single Shift 2
  SS3 = "O", // Single Shift 3
  DECPAM = "=", // Application Keypad Mode
  DECPNM = ">", // Normal Keypad Mode
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
}
