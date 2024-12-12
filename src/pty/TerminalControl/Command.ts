// Extended control character set
export enum ControlCharacter {
  // C0 controls (0x00-0x1F)
  NUL = 0x00, // Null
  SOH = 0x01, // Start of Heading
  STX = 0x02, // Start of Text
  ETX = 0x03, // End of Text
  EOT = 0x04, // End of Transmission
  ENQ = 0x05, // Enquiry
  ACK = 0x06, // Acknowledge
  BEL = 0x07, // Bell
  BS = 0x08, // Backspace
  HT = 0x09, // Horizontal Tab
  LF = 0x0a, // Line Feed
  VT = 0x0b, // Vertical Tab
  FF = 0x0c, // Form Feed
  CR = 0x0d, // Carriage Return
  SO = 0x0e, // Shift Out
  SI = 0x0f, // Shift In
  DLE = 0x10, // Data Link Escape
  DC1 = 0x11, // Device Control 1 (XON)
  DC2 = 0x12, // Device Control 2
  DC3 = 0x13, // Device Control 3 (XOFF)
  DC4 = 0x14, // Device Control 4
  NAK = 0x15, // Negative Acknowledge
  SYN = 0x16, // Synchronous Idle
  ETB = 0x17, // End of Transmission Block
  CAN = 0x18, // Cancel
  EM = 0x19, // End of Medium
  SUB = 0x1a, // Substitute
  ESC = 0x1b, // Escape
  FS = 0x1c, // File Separator
  GS = 0x1d, // Group Separator
  RS = 0x1e, // Record Separator
  US = 0x1f, // Unit Separator
  DEL = 0x7f, // Delete

  // C1 controls (8-bit form, 0x80-0x9F)
  PAD = 0x80, // Padding Character
  HOP = 0x81, // High Octet Preset
  BPH = 0x82, // Break Permitted Here
  NBH = 0x83, // No Break Here
  IND = 0x84, // Index
  NEL = 0x85, // Next Line
  SSA = 0x86, // Start of Selected Area
  ESA = 0x87, // End of Selected Area
  HTS = 0x88, // Horizontal Tab Set
  HTJ = 0x89, // Horizontal Tab with Justification
  VTS = 0x8a, // Vertical Tab Set
  PLD = 0x8b, // Partial Line Down
  PLU = 0x8c, // Partial Line Up
  RI = 0x8d, // Reverse Index
  SS2 = 0x8e, // Single Shift 2
  SS3 = 0x8f, // Single Shift 3
  DCS = 0x90, // Device Control String
  PU1 = 0x91, // Private Use 1
  PU2 = 0x92, // Private Use 2
  STS = 0x93, // Set Transmit State
  CCH = 0x94, // Cancel Character
  MW = 0x95, // Message Waiting
  SPA = 0x96, // Start of Protected Area
  EPA = 0x97, // End of Protected Area
  SOS = 0x98, // Start of String
  SGC = 0x99, // Single Graphic Character
  SCI = 0x9a, // Single Character Introducer
  CSI = 0x9b, // Control Sequence Introducer
  ST = 0x9c, // String Terminator
  OSC = 0x9d, // Operating System Command
  PM = 0x9e, // Privacy Message
  APC = 0x9f, // Application Program Command
}

// Sequence types for classification
export enum SequenceType {
  C0, // Single byte control
  C1, // 8-bit or 2-byte control
  CSI, // Control Sequence Introducer
  DCS, // Device Control String
  OSC, // Operating System Command
  PM, // Privacy Message
  APC, // Application Program Command
  ESCAPE, // Simple escape sequence
  TEXT, // Text sequence
  UNKNOWN, // Unknown sequence type
  SGR, // Select Graphic Rendition
  MOUSE, // Mouse tracking sequences
  CHARSET, // Character set selection
  MODE, // Mode setting/resetting
}

// Utility type for mouse encoding modes
export enum MouseEncoding {
  DEFAULT = 0,
  SGR = 1,
  URXVT = 2,
  UTF8 = 3,
}

// Charset types
export enum CharacterSet {
  ASCII = 0,
  UK = 1,
  SPECIAL = 2,
  ALT = 3,
  ALT_SPECIAL = 4,
}

export interface Parameter {
  value: number | null;
  private?: boolean; // For parameters starting with ?
  defaultValue?: number;
  subParameters?: number[]; // For colon-separated sub-parameters
}

// Base interface for all control sequences
export interface BaseSequence {
  readonly type: SequenceType;
  readonly controlChar: ControlCharacter;
  readonly raw: Uint8Array; // Original byte sequence
  isValid(): boolean;
  toString(): string;
}

// Interface for sequences that can have intermediate bytes
export interface IntermediateBytes {
  readonly intermediateBytes: number[];
}

// Interface for sequences that can have parameters
export interface ParameterizedSequence extends BaseSequence {
  readonly parameters: Parameter[];
}

// Interface for string-containing sequences
export interface StringSequence extends BaseSequence {
  readonly stringContent: string;
  readonly terminator: ControlCharacter.ST | ControlCharacter.BEL;
}

export interface SGRSequence extends ParameterizedSequence {
  readonly type: SequenceType.SGR;
  readonly attributes: {
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
    blink?: boolean;
    inverse?: boolean;
    hidden?: boolean;
    strike?: boolean;
    foreground?: number;
    background?: number;
  };
}

export interface MouseSequence extends ParameterizedSequence {
  readonly type: SequenceType.MOUSE;
  readonly button: number;
  readonly x: number;
  readonly y: number;
  readonly modifiers: {
    shift?: boolean;
    alt?: boolean;
    control?: boolean;
  };
}

// Base abstract class with common functionality
export abstract class VT100Sequence implements BaseSequence {
  constructor(
    public readonly type: SequenceType,
    public readonly controlChar: ControlCharacter,
    public readonly raw: Uint8Array
  ) {}

  abstract isValid(): boolean;
  abstract toString(): string;

  // Common validation methods
  protected isIntermediateByte(byte: number): boolean {
    return byte >= 0x20 && byte <= 0x2f;
  }

  protected isFinalByte(byte: number): boolean {
    return byte >= 0x40 && byte <= 0x7e;
  }

  protected isParameterByte(byte: number): boolean {
    return byte >= 0x30 && byte <= 0x3f; // includes digits, ;:<?=
  }
}
