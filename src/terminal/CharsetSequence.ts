import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";

// Character set designators
export enum CharsetDesignator {
  G0 = "(", // G0 set (default)
  G1 = ")", // G1 set
  G2 = "*", // G2 set
  G3 = "+", // G3 set
}

// Standard character sets
enum CharacterSet {
  USASCII = "B", // US ASCII set
  UK = "A", // UK ASCII variant
  SpecialGraphics = "0", // Line drawing and symbols
  AlternateROM = "1", // Alternate character ROM
  AlternateROMS = "2", // Alternate character ROM special graphics
  Dutch = "4", // Dutch
  Finnish = "C", // Finnish
  French = "R", // French
  FrenchCanadian = "Q", // French Canadian
  German = "K", // German
  Italian = "Y", // Italian
  Norwegian = "`", // Norwegian/Danish
  Spanish = "Z", // Spanish
  Swedish = "H", // Swedish
  Swiss = "=", // Swiss
}

export class CharsetSequence extends VT100Sequence {
  constructor(
    raw: Uint8Array,
    public readonly designator: CharsetDesignator,
    public readonly charset: number
  ) {
    super(SequenceType.ESCAPE, ControlCharacter.ESC, raw);
  }

  isValid(): boolean {
    // Validation rules:
    // 1. Designator must be valid
    // 2. Charset must be a valid final byte
    // 3. Specific combinations might be invalid for certain terminals

    const isValidDesignator = Object.values(CharsetDesignator).includes(
      String.fromCharCode(this.designator.charCodeAt(0)) as CharsetDesignator
    );

    const charsetChar = String.fromCharCode(this.charset);
    const isValidCharset =
      Object.values(CharacterSet).includes(charsetChar as CharacterSet) ||
      this.isCustomCharset();

    return isValidDesignator && isValidCharset;
  }

  private isCustomCharset(): boolean {
    // Some terminals support additional character sets
    // This method can be extended for terminal-specific implementations
    const code = this.charset;
    return (
      code >= 0x30 &&
      code <= 0x7e && // Valid final byte range
      !Object.values(CharacterSet).includes(
        String.fromCharCode(code) as CharacterSet
      )
    );
  }

  toString(): string {
    return `\x1B${this.designator}${String.fromCharCode(this.charset)}`;
  }

  // Helper method to get the standard charset type if it's a known charset
  getCharsetType(): CharacterSet | null {
    const charsetChar = String.fromCharCode(this.charset);
    return Object.values(CharacterSet).includes(charsetChar as CharacterSet)
      ? (charsetChar as CharacterSet)
      : null;
  }

  // Helper method to determine if this is a graphics set
  isGraphicsSet(): boolean {
    const charset = this.getCharsetType();
    return (
      charset === CharacterSet.SpecialGraphics ||
      charset === CharacterSet.AlternateROMS
    );
  }

  // Static helper to create common charset sequences
  static createG0(charset: CharacterSet): CharsetSequence {
    return new CharsetSequence(
      new Uint8Array([
        ControlCharacter.ESC,
        CharsetDesignator.G0.charCodeAt(0),
        charset.charCodeAt(0),
      ]),
      CharsetDesignator.G0,
      charset.charCodeAt(0)
    );
  }

  static createG1(charset: CharacterSet): CharsetSequence {
    return new CharsetSequence(
      new Uint8Array([
        ControlCharacter.ESC,
        CharsetDesignator.G1.charCodeAt(0),
        charset.charCodeAt(0),
      ]),
      CharsetDesignator.G1,
      charset.charCodeAt(0)
    );
  }

  // Additional static helpers for G2 and G3 if needed
}
