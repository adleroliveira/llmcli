import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";

// C1 control characters (0x80-0x9F)
export const C1Control = {
  PAD: [0x80, 0x40] as const, // Padding Character
  HOP: [0x81, 0x41] as const, // High Octet Preset
  BPH: [0x82, 0x42] as const, // Break Permitted Here
  NBH: [0x83, 0x43] as const, // No Break Here
  IND: [0x84, 0x44] as const, // Index
  NEL: [0x85, 0x45] as const, // Next Line
  SSA: [0x86, 0x46] as const, // Start of Selected Area
  ESA: [0x87, 0x47] as const, // End of Selected Area
  HTS: [0x88, 0x48] as const, // Horizontal Tab Set
  HTJ: [0x89, 0x49] as const, // Horizontal Tab with Justify
  VTS: [0x8a, 0x4a] as const, // Vertical Tab Set
  PLD: [0x8b, 0x4b] as const, // Partial Line Down
  PLU: [0x8c, 0x4c] as const, // Partial Line Up
  RI: [0x8d, 0x4d] as const, // Reverse Index
  SS2: [0x8e, 0x4e] as const, // Single Shift 2
  SS3: [0x8f, 0x4f] as const, // Single Shift 3
  DCS: [0x90, 0x50] as const, // Device Control String
  PU1: [0x91, 0x51] as const, // Private Use 1
  PU2: [0x92, 0x52] as const, // Private Use 2
  STS: [0x93, 0x53] as const, // Set Transmit State
  CCH: [0x94, 0x54] as const, // Cancel Character
  MW: [0x95, 0x55] as const, // Message Waiting
  SPA: [0x96, 0x56] as const, // Start of Protected Area
  EPA: [0x97, 0x57] as const, // End of Protected Area
  SOS: [0x98, 0x58] as const, // Start of String
  SGCI: [0x99, 0x59] as const, // Single Graphic Character Introducer
  SCI: [0x9a, 0x5a] as const, // Single Character Introducer
  CSI: [0x9b, 0x5b] as const, // Control Sequence Introducer
  ST: [0x9c, 0x5c] as const, // String Terminator
  OSC: [0x9d, 0x5d] as const, // Operating System Command
  PM: [0x9e, 0x5e] as const, // Privacy Message
  APC: [0x9f, 0x5f] as const, // Application Program Command
} as const;

// Type for control codes to maintain type safety
type C1ControlCode = keyof typeof C1Control;

// Type for representing mode of C1 transmission
export enum C1Mode {
  BIT_8 = "8-bit",
  BIT_7 = "7-bit",
}

export class C1ControlSequence extends VT100Sequence {
  private readonly control: readonly [number, number];
  private readonly mode: C1Mode;

  constructor(
    raw: Uint8Array,
    public readonly controlType: keyof typeof C1Control,
    mode: C1Mode = C1Mode.BIT_7 // Default to 7-bit as it's more widely supported
  ) {
    super(SequenceType.C1, ControlCharacter.ESC, raw);
    this.control = C1Control[controlType];
    this.mode = mode;
  }

  is8BitMode(): boolean {
    return this.mode === C1Mode.BIT_8;
  }

  get8BitCode(): number {
    return this.control[0];
  }

  get7BitCode(): number {
    return this.control[1];
  }

  isValid(): boolean {
    // Validation rules for C1 controls
    // 1. Must be a valid C1 control type
    // 2. Must not conflict with other sequence types

    // Check if it's a valid C1 control
    if (!Object.keys(C1Control).includes(this.controlType)) {
      return false;
    }

    // Some C1 controls shouldn't be used if they have dedicated sequence types
    const invalidStandaloneControls = ["CSI", "DCS", "OSC", "PM", "APC", "ST"];

    return !invalidStandaloneControls.includes(this.controlType);
  }

  toString(): string {
    if (this.mode === C1Mode.BIT_8) {
      // 8-bit form: single byte
      return String.fromCharCode(this.get8BitCode());
    } else {
      // 7-bit form: ESC + byte
      return `\x1B${String.fromCharCode(this.get7BitCode())}`;
    }
  }

  // Convert between 7-bit and 8-bit representations
  to8Bit(): C1ControlSequence {
    if (this.mode === C1Mode.BIT_8) return this;

    return new C1ControlSequence(
      new Uint8Array([this.get8BitCode()]),
      this.controlType,
      C1Mode.BIT_8
    );
  }

  to7Bit(): C1ControlSequence {
    if (this.mode === C1Mode.BIT_7) return this;

    return new C1ControlSequence(
      new Uint8Array([ControlCharacter.ESC, this.get7BitCode()]),
      this.controlType,
      C1Mode.BIT_7
    );
  }

  // Static helper methods
  static create(
    controlType: keyof typeof C1Control,
    mode: C1Mode = C1Mode.BIT_7
  ): C1ControlSequence {
    const control = C1Control[controlType];
    const raw =
      mode === C1Mode.BIT_8
        ? new Uint8Array([control[0]])
        : new Uint8Array([ControlCharacter.ESC, control[1]]);

    return new C1ControlSequence(raw, controlType, mode);
  }

  // Helper to detect if a byte is a C1 control
  static isC1Byte(byte: number): boolean {
    return byte >= 0x80 && byte <= 0x9f;
  }

  // Helper to convert a C1 byte to its 7-bit equivalent
  static convertToEscSequence(byte: number): [number, number] | null {
    if (!this.isC1Byte(byte)) return null;

    const escByte = byte - 0x40;
    return [ControlCharacter.ESC, escByte];
  }
}
