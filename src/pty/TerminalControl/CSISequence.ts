import {
  VT100Sequence,
  ParameterizedSequence,
  IntermediateBytes,
  Parameter,
  ControlCharacter,
  SequenceType,
} from "./Command.js";

export class CSISequence
  extends VT100Sequence
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

  isValid(): boolean {
    return (
      this.isFinalByte(this.finalByte) &&
      this.intermediateBytes.every((b) => this.isIntermediateByte(b))
    );
  }

  toString(): string {
    const params = this.parameters
      .map((p) => {
        // Handle null value case
        const paramValue = p.value === null ? "" : p.value.toString();
        return p.private ? `?${paramValue}` : paramValue;
      })
      .join(";");
    const intermediate = String.fromCharCode(...this.intermediateBytes);
    return `\x1B[${params}${intermediate}${String.fromCharCode(
      this.finalByte
    )}`;
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

  private static isIntermediateByte(byte: number): boolean {
    return byte >= 0x20 && byte <= 0x2f;
  }

  private static isFinalByte(byte: number): boolean {
    return byte >= 0x40 && byte <= 0x7e;
  }

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

      // Check for private parameter marker
      if (byte === 0x3f && i === startIndex) {
        // '?'
        isPrivate = true;
        continue;
      }

      // Parameter separator
      if (byte === 0x3b) {
        // ';'
        params.push({
          value: currentValue.length ? parseInt(currentValue) : null,
          private: isPrivate,
        });
        currentValue = "";
        continue;
      }

      // Accumulate numeric characters
      if (byte >= 0x30 && byte <= 0x39) {
        // '0' to '9'
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
      throw new Error("Invalid CSI sequence: too short");
    }

    // Find the final byte
    let finalByteIndex = -1;
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (this.isFinalByte(bytes[i])) {
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
      if (this.isIntermediateByte(bytes[i])) {
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
    const commandMap: { [key: number]: string } = {
      0x41: "CUU", // Cursor Up
      0x42: "CUD", // Cursor Down
      0x43: "CUF", // Cursor Forward
      0x44: "CUB", // Cursor Back
      0x45: "CNL", // Cursor Next Line
      0x46: "CPL", // Cursor Previous Line
      0x47: "CHA", // Cursor Horizontal Absolute
      0x48: "CUP", // Cursor Position
      0x4a: "ED", // Erase in Display
      0x4b: "EL", // Erase in Line
      0x53: "SU", // Scroll Up
      0x54: "SD", // Scroll Down
      0x68: "SM", // Set Mode
      0x6c: "RM", // Reset Mode
      0x6d: "SGR", // Select Graphic Rendition
      0x72: "DECSTBM", // Set Scrolling Region
      0x73: "SCOSC", // Save Cursor Position
      0x75: "SCORC", // Restore Cursor Position
    };

    return commandMap[this.finalByte] || String.fromCharCode(this.finalByte);
  }

  includesParam(value: number): boolean {
    return this.parameters.some((param) => param.value === value);
  }
}
