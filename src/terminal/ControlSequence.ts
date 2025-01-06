import { ANSISequence, SequenceType, ControlCharacter } from "./Command.js";

export enum C0Command {
  NUL = "NUL", // Null
  SOH = "SOH", // Start of Heading
  STX = "STX", // Start of Text
  ETX = "ETX", // End of Text
  EOT = "EOT", // End of Transmission
  ENQ = "ENQ", // Enquiry
  ACK = "ACK", // Acknowledge
  BEL = "BEL", // Bell
  BS = "BS", // Backspace
  HT = "HT", // Horizontal Tab
  LF = "LF", // Line Feed
  VT = "VT", // Vertical Tab
  FF = "FF", // Form Feed
  CR = "CR", // Carriage Return
  SO = "SO", // Shift Out
  SI = "SI", // Shift In
  DLE = "DLE", // Data Link Escape
  DC1 = "DC1", // Device Control 1 (XON)
  DC2 = "DC2", // Device Control 2
  DC3 = "DC3", // Device Control 3 (XOFF)
  DC4 = "DC4", // Device Control 4
  NAK = "NAK", // Negative Acknowledge
  SYN = "SYN", // Synchronous Idle
  ETB = "ETB", // End of Transmission Block
  CAN = "CAN", // Cancel
  EM = "EM", // End of Medium
  SUB = "SUB", // Substitute
  ESC = "ESC", // Escape
  FS = "FS", // File Separator
  GS = "GS", // Group Separator
  RS = "RS", // Record Separator
  US = "US", // Unit Separator
  DEL = "DEL", // Delete
}

export class C0Sequence extends ANSISequence {
  constructor(
    public readonly controlChar: ControlCharacter,
    public readonly repeat: number = 1
  ) {
    super(
      SequenceType.C0,
      controlChar,
      new Uint8Array([controlChar]) // controlChar is already a number
    );
  }

  get command(): C0Command {
    const commandMap: { [key: number]: C0Command } = {
      0x00: C0Command.NUL,
      0x01: C0Command.SOH,
      0x02: C0Command.STX,
      0x03: C0Command.ETX,
      0x04: C0Command.EOT,
      0x05: C0Command.ENQ,
      0x06: C0Command.ACK,
      0x07: C0Command.BEL,
      0x08: C0Command.BS,
      0x09: C0Command.HT,
      0x0a: C0Command.LF,
      0x0b: C0Command.VT,
      0x0c: C0Command.FF,
      0x0d: C0Command.CR,
      0x0e: C0Command.SO,
      0x0f: C0Command.SI,
      0x10: C0Command.DLE,
      0x11: C0Command.DC1,
      0x12: C0Command.DC2,
      0x13: C0Command.DC3,
      0x14: C0Command.DC4,
      0x15: C0Command.NAK,
      0x16: C0Command.SYN,
      0x17: C0Command.ETB,
      0x18: C0Command.CAN,
      0x19: C0Command.EM,
      0x1a: C0Command.SUB,
      0x1b: C0Command.ESC,
      0x1c: C0Command.FS,
      0x1d: C0Command.GS,
      0x1e: C0Command.RS,
      0x1f: C0Command.US,
      0x7f: C0Command.DEL,
    };

    return commandMap[this.controlChar] || C0Command.NUL;
  }

  isValid(): boolean {
    return this.raw[0] <= 0x1f || this.raw[0] === 0x7f; // Valid C0 range plus DEL
  }

  toString(): string {
    // Convert the control character to a string and repeat it
    return String.fromCharCode(this.controlChar).repeat(this.repeat);
  }

  // Helper static methods for common C0 control characters
  static backspace(count: number = 1): C0Sequence {
    return new C0Sequence(ControlCharacter.BS, count);
  }

  static bell(): C0Sequence {
    return new C0Sequence(ControlCharacter.BEL);
  }

  static tab(count: number = 1): C0Sequence {
    return new C0Sequence(ControlCharacter.HT, count);
  }

  static lineFeed(count: number = 1): C0Sequence {
    return new C0Sequence(ControlCharacter.LF, count);
  }

  static carriageReturn(): C0Sequence {
    return new C0Sequence(ControlCharacter.CR);
  }

  // Additional helper methods
  static formFeed(): C0Sequence {
    return new C0Sequence(ControlCharacter.FF);
  }

  static verticalTab(count: number = 1): C0Sequence {
    return new C0Sequence(ControlCharacter.VT, count);
  }

  static cancel(): C0Sequence {
    return new C0Sequence(ControlCharacter.CAN);
  }

  static substitute(): C0Sequence {
    return new C0Sequence(ControlCharacter.SUB);
  }

  // Utility methods
  static isC0ControlCharacter(char: number): boolean {
    return char <= 0x1f || char === 0x7f;
  }

  static fromChar(char: string): C0Sequence {
    const charCode = char.charCodeAt(0);
    if (!this.isC0ControlCharacter(charCode)) {
      throw new Error(`Invalid C0 control character: ${char}`);
    }
    return new C0Sequence(charCode);
  }

  static from(bytes: Uint8Array): C0Sequence {
    if (bytes.length === 0) {
      throw new Error("Empty byte array");
    }
    if (!this.isC0ControlCharacter(bytes[0])) {
      throw new Error(`Invalid C0 control character: ${bytes[0]}`);
    }
    return new C0Sequence(bytes[0]);
  }

  equals(other: C0Sequence): boolean {
    return (
      this.controlChar === other.controlChar && this.repeat === other.repeat
    );
  }
}
