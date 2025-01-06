import {
  ANSISequence,
  ParameterizedSequence,
  IntermediateBytes,
  Parameter,
  ControlCharacter,
  SequenceType,
} from "./Command.js";

export enum CSICommand {
  // Cursor commands
  CUU = "A", // Cursor Up
  CUD = "B", // Cursor Down
  CUF = "C", // Cursor Forward
  CUB = "D", // Cursor Back
  CNL = "E", // Cursor Next Line
  CPL = "F", // Cursor Previous Line
  CHA = "G", // Cursor Horizontal Absolute
  CUP = "H", // Cursor Position
  VPA = "d", // Vertical Position Absolute
  CHT = "I", // Cursor Forward Tabulation
  CBT = "Z", // Cursor Backward Tabulation
  DSR = "n", // Device Status Report (used for cursor position reporting)

  // Erase commands
  ED = "J", // Erase in Display
  EL = "K", // Erase in Line

  // Screen commands
  SU = "S", // Scroll Up
  SD = "T", // Scroll Down
  DECSTBM = "r", // Set Scrolling Region

  // Mode commands
  SM = "h", // Set Mode
  RM = "l", // Reset Mode

  // Other commands
  SGR = "m", // Select Graphic Rendition
  SCOSC = "s", // Save Cursor Position
  SCORC = "u", // Restore Cursor Position

  // Window commands
  XTWINOPS = "t", // Window Manipulation

  // Erase/Delete commands
  DCH = "P", // Delete Character
  DL = "M", // Delete Line
  ICH = "@", // Insert Character
  IL = "L", // Insert Line

  // Screen commands
  DECSLRM = "s", // Set Left and Right Margins
  DECALN = "#8", // Screen Alignment Pattern

  // Additional screen commands
  DECSTR = "!p", // Soft terminal reset
  DECRQM = "$p", // Request Mode - DEC Private Mode
  DECDSR = "$q", // Device Status Report - DEC Specific
  DECSCUSR = "q", // Set Cursor Style

  // Additional window commands
  DECCRA = "$v", // Copy Rectangular Area
  DECFRA = "$x", // Fill Rectangular Area
  DECERA = "$z", // Erase Rectangular Area

  // Additional mode commands
  DECSCA = '"q', // Select Character Protection Attribute
  DECSCL = '"p', // Set Conformance Level
  DECLL = "q", // Load LEDs

  DECRQPSR = "$w", // Request Presentation State Report
  DECSNLS = "*|", // Set Number of Lines per Screen
  DECSLPP = "t", // Set Lines Per Page
}

export enum SGRAttribute {
  Reset = 0,
  Bold = 1,
  Dim = 2,
  Italic = 3,
  Underline = 4,
  BlinkSlow = 5,
  BlinkRapid = 6,
  Inverse = 7,
  Hidden = 8,
  StrikeThrough = 9,

  // Reset individual attributes
  BoldOff = 22,
  ItalicOff = 23,
  UnderlineOff = 24,
  BlinkOff = 25,
  InverseOff = 27,
  StrikeThroughOff = 29,
}

// Standard 16-color support
export enum SGRColor {
  // Foreground colors
  Black = 30,
  Red = 31,
  Green = 32,
  Yellow = 33,
  Blue = 34,
  Magenta = 35,
  Cyan = 36,
  White = 37,
  Default = 39,

  // Background colors
  BgBlack = 40,
  BgRed = 41,
  BgGreen = 42,
  BgYellow = 43,
  BgBlue = 44,
  BgMagenta = 45,
  BgCyan = 46,
  BgWhite = 47,
  BgDefault = 49,

  // Bright foreground colors
  BrightBlack = 90,
  BrightRed = 91,
  BrightGreen = 92,
  BrightYellow = 93,
  BrightBlue = 94,
  BrightMagenta = 95,
  BrightCyan = 96,
  BrightWhite = 97,

  // Bright background colors
  BgBrightBlack = 100,
  BgBrightRed = 101,
  BgBrightGreen = 102,
  BgBrightYellow = 103,
  BgBrightBlue = 104,
  BgBrightMagenta = 105,
  BgBrightCyan = 106,
  BgBrightWhite = 107,
}

export class TextFormatter {
  private static createSGR(...params: number[]): string {
    return CSISequence.create(CSICommand.SGR, params).toString();
  }

  static rgb(r: number, g: number, b: number, isBackground = false): string {
    const prefix = isBackground ? 48 : 38;
    return this.createSGR(prefix, 2, r, g, b);
  }

  static color256(code: number, isBackground = false): string {
    const prefix = isBackground ? 48 : 38;
    return this.createSGR(prefix, 5, code);
  }
}

export class CSISequence
  extends ANSISequence
  implements ParameterizedSequence, IntermediateBytes
{
  constructor(
    raw: Uint8Array,
    public readonly parameters: Parameter[],
    public readonly intermediateBytes: number[],
    public readonly finalByte: number
  ) {
    super(SequenceType.CSI, ControlCharacter.CSI, raw);
  }

  static create(
    command: CSICommand,
    params: (number | null)[] = [],
    isPrivate: boolean = false
  ): CSISequence {
    const parameters: Parameter[] = params.map((value) => ({
      value,
      private: isPrivate,
    }));

    const bytes: number[] = [0x1b, 0x5b]; // ESC [

    if (isPrivate) {
      bytes.push(0x3f); // '?'
    }

    parameters.forEach((param, index) => {
      if (index > 0) {
        bytes.push(0x3b); // ';'
      }
      if (param.value !== null) {
        const paramStr = param.value.toString();
        for (const char of paramStr) {
          bytes.push(char.charCodeAt(0));
        }
      }
    });

    bytes.push(command.charCodeAt(0));

    return new CSISequence(
      new Uint8Array(bytes),
      parameters,
      [],
      command.charCodeAt(0)
    );
  }

  isValid(): boolean {
    return (
      this.isFinalByte(this.finalByte) &&
      this.intermediateBytes.every((b) => this.isIntermediateByte(b))
    );
  }

  toString(): string {
    const params = this.parameters
      .map(
        (p) =>
          (p.private ? "?" : "") + (p.value === null ? "" : p.value.toString())
      )
      .join(";");
    return `\x1B[${params}${
      this.intermediateBytes.length
        ? String.fromCharCode(...this.intermediateBytes)
        : ""
    }${String.fromCharCode(this.finalByte)}`;
  }

  static fromParameters(
    parameters: Parameter[],
    command: CSICommand,
    isPrivate: boolean = false
  ): CSISequence {
    // Convert Parameter array to array of values for create() method
    const paramValues = parameters.map((p) => p.value);

    // Use the existing create() method
    return CSISequence.create(command, paramValues, isPrivate);
  }

  static isCursorCommand = (sequence: CSISequence): boolean => {
    const finalByte = sequence.finalByte;
    return [
      0x41, // 'A' - Cursor Up
      0x42, // 'B' - Cursor Down
      0x43, // 'C' - Cursor Forward
      0x44, // 'D' - Cursor Back
      0x45, // 'E' - Cursor Next Line
      0x46, // 'F' - Cursor Previous Line
      0x47, // 'G' - Cursor Horizontal Absolute
      0x48, // 'H' - Cursor Position
      0x73, // 's' - Save Cursor Position
      0x75, // 'u' - Restore Cursor Position
    ].includes(finalByte);
  };

  static isSgrCommand = (sequence: CSISequence): boolean => {
    const finalByte = sequence.finalByte;
    return finalByte === 0x6d; // 'm' - Select Graphic Rendition
  };

  static isEraseCommand = (sequence: CSISequence): boolean => {
    const finalByte = sequence.finalByte;
    return [
      0x4a, // 'J' - Erase in Display
      0x4b, // 'K' - Erase in Line
    ].includes(finalByte);
  };

  static isScreenCommand = (sequence: CSISequence): boolean => {
    const finalByte = sequence.finalByte;
    return [
      0x72, // 'r' - Set Scrolling Region
      0x53, // 'S' - Scroll Up
      0x54, // 'T' - Scroll Down
    ].includes(finalByte);
  };

  static isModeCommand = (sequence: CSISequence): boolean => {
    const finalByte = sequence.finalByte;
    return [
      0x68, // 'h' - Set Mode
      0x6c, // 'l' - Reset Mode
    ].includes(finalByte);
  };

  static isCursorVisibilityCommand(sequence: CSISequence): boolean {
    return (
      (sequence.finalByte === 0x68 || sequence.finalByte === 0x6c) && // 'h' or 'l'
      sequence.parameters[0]?.value === 25
    );
  }

  static isWindowCommand = (sequence: CSISequence): boolean => {
    const finalByte = sequence.finalByte;
    return finalByte === 0x74; // 't' - Window Manipulation (XTWINOPS)
  };

  static isInsertDeleteCommand = (sequence: CSISequence): boolean => {
    const finalByte = sequence.finalByte;
    return [
      0x50, // 'P' - Delete Character (DCH)
      0x4d, // 'M' - Delete Line (DL)
      0x40, // '@' - Insert Character (ICH)
      0x4c, // 'L' - Insert Line (IL)
    ].includes(finalByte);
  };

  private static parseParameters(
    bytes: Uint8Array,
    startIndex: number,
    endIndex: number
  ): Parameter[] {
    const params: Parameter[] = [];
    let currentValue = "";
    let isPrivate = false;

    for (let i = startIndex; i < endIndex; i++) {
      const byte = bytes[i];

      // Check for private parameter marker ('?')
      if (byte === 0x3f && i === startIndex) {
        isPrivate = true;
        continue;
      }

      // Parameter separator (';')
      if (byte === 0x3b) {
        params.push({
          value: currentValue.length ? parseInt(currentValue) : null,
          private: isPrivate,
        });
        currentValue = "";
        continue;
      }

      if (ANSISequence.isParameterByte(byte) && byte >= 0x30 && byte <= 0x39) {
        currentValue += String.fromCharCode(byte);
      }
    }

    // Push the last parameter if exists
    if (currentValue.length || params.length === 0) {
      params.push({
        value: currentValue.length ? parseInt(currentValue) : null,
        private: isPrivate,
      });
    }

    return params;
  }

  static from(bytes: Uint8Array): CSISequence {
    if (bytes.length < 2) {
      throw new Error(
        `Invalid CSI sequence: length ${bytes.length} is less than minimum 2 bytes`
      );
    }

    // Find the final byte
    let finalByteIndex = -1;
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (ANSISequence.isFinalByte(bytes[i])) {
        finalByteIndex = i;
        break;
      }
    }

    if (finalByteIndex === -1) {
      throw new Error("Invalid CSI sequence: no final byte found");
    }

    // Collect intermediate bytes
    const intermediateBytes: number[] = [];
    let parameterEndIndex = 0;
    for (let i = 0; i < finalByteIndex; i++) {
      if (ANSISequence.isIntermediateByte(bytes[i])) {
        intermediateBytes.push(bytes[i]);
      } else {
        parameterEndIndex = i + 1;
      }
    }

    // Parse parameters
    const parameters = this.parseParameters(bytes, 0, parameterEndIndex);

    // Create new instance
    const sequence = new CSISequence(
      bytes,
      parameters,
      intermediateBytes,
      bytes[finalByteIndex]
    );

    if (!sequence.isValid()) {
      throw new Error("Invalid CSI sequence: validation failed");
    }

    return sequence;
  }

  static fromStr(text: string): CSISequence {
    // Convert escaped sequence to bytes
    const bytes: number[] = [];

    // Skip the ESC[ prefix
    if (!text.startsWith("\x1B[")) {
      throw new Error("Invalid CSI sequence string: must start with ESC[");
    }

    // Convert remaining characters to bytes
    for (let i = 2; i < text.length; i++) {
      bytes.push(text.charCodeAt(i));
    }

    return this.from(new Uint8Array(bytes));
  }

  get command(): string {
    const commandMap: { [key: number]: CSICommand } = {
      0x41: CSICommand.CUU, // Cursor Up
      0x42: CSICommand.CUD, // Cursor Down
      0x43: CSICommand.CUF, // Cursor Forward
      0x44: CSICommand.CUB, // Cursor Back
      0x45: CSICommand.CNL, // Cursor Next Line
      0x46: CSICommand.CPL, // Cursor Previous Line
      0x47: CSICommand.CHA, // Cursor Horizontal Absolute
      0x48: CSICommand.CUP, // Cursor Position
      0x4a: CSICommand.ED, // Erase in Display
      0x4b: CSICommand.EL, // Erase in Line
      0x53: CSICommand.SU, // Scroll Up
      0x54: CSICommand.SD, // Scroll Down
      0x68: CSICommand.SM, // Set Mode
      0x6c: CSICommand.RM, // Reset Mode
      0x6d: CSICommand.SGR, // Select Graphic Rendition
      0x72: CSICommand.DECSTBM, // Set Scrolling Region
      0x73: CSICommand.SCOSC, // Save Cursor Position
      0x75: CSICommand.SCORC, // Restore Cursor Position
    };

    return (
      commandMap[this.finalByte] ||
      (String.fromCharCode(this.finalByte) as CSICommand)
    );
  }

  includesParam(value: number): boolean {
    return this.parameters.some((param) => param.value === value);
  }
}
