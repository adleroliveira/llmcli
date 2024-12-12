import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";
// C1 control characters (0x80-0x9F)
const C1Control = {
    PAD: [0x80, 0x40], // Padding Character
    HOP: [0x81, 0x41], // High Octet Preset
    BPH: [0x82, 0x42], // Break Permitted Here
    NBH: [0x83, 0x43], // No Break Here
    IND: [0x84, 0x44], // Index
    NEL: [0x85, 0x45], // Next Line
    SSA: [0x86, 0x46], // Start of Selected Area
    ESA: [0x87, 0x47], // End of Selected Area
    HTS: [0x88, 0x48], // Horizontal Tab Set
    HTJ: [0x89, 0x49], // Horizontal Tab with Justify
    VTS: [0x8a, 0x4a], // Vertical Tab Set
    PLD: [0x8b, 0x4b], // Partial Line Down
    PLU: [0x8c, 0x4c], // Partial Line Up
    RI: [0x8d, 0x4d], // Reverse Index
    SS2: [0x8e, 0x4e], // Single Shift 2
    SS3: [0x8f, 0x4f], // Single Shift 3
    DCS: [0x90, 0x50], // Device Control String
    PU1: [0x91, 0x51], // Private Use 1
    PU2: [0x92, 0x52], // Private Use 2
    STS: [0x93, 0x53], // Set Transmit State
    CCH: [0x94, 0x54], // Cancel Character
    MW: [0x95, 0x55], // Message Waiting
    SPA: [0x96, 0x56], // Start of Protected Area
    EPA: [0x97, 0x57], // End of Protected Area
    SOS: [0x98, 0x58], // Start of String
    SGCI: [0x99, 0x59], // Single Graphic Character Introducer
    SCI: [0x9a, 0x5a], // Single Character Introducer
    CSI: [0x9b, 0x5b], // Control Sequence Introducer
    ST: [0x9c, 0x5c], // String Terminator
    OSC: [0x9d, 0x5d], // Operating System Command
    PM: [0x9e, 0x5e], // Privacy Message
    APC: [0x9f, 0x5f], // Application Program Command
};
// Type for representing mode of C1 transmission
var C1Mode;
(function (C1Mode) {
    C1Mode["BIT_8"] = "8-bit";
    C1Mode["BIT_7"] = "7-bit";
})(C1Mode || (C1Mode = {}));
export class C1ControlSequence extends VT100Sequence {
    constructor(raw, controlType, mode = C1Mode.BIT_7 // Default to 7-bit as it's more widely supported
    ) {
        super(SequenceType.C1, ControlCharacter.ESC, raw);
        this.controlType = controlType;
        this.control = C1Control[controlType];
        this.mode = mode;
    }
    is8BitMode() {
        return this.mode === C1Mode.BIT_8;
    }
    get8BitCode() {
        return this.control[0];
    }
    get7BitCode() {
        return this.control[1];
    }
    isValid() {
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
    toString() {
        if (this.mode === C1Mode.BIT_8) {
            // 8-bit form: single byte
            return String.fromCharCode(this.get8BitCode());
        }
        else {
            // 7-bit form: ESC + byte
            return `\x1B${String.fromCharCode(this.get7BitCode())}`;
        }
    }
    // Convert between 7-bit and 8-bit representations
    to8Bit() {
        if (this.mode === C1Mode.BIT_8)
            return this;
        return new C1ControlSequence(new Uint8Array([this.get8BitCode()]), this.controlType, C1Mode.BIT_8);
    }
    to7Bit() {
        if (this.mode === C1Mode.BIT_7)
            return this;
        return new C1ControlSequence(new Uint8Array([ControlCharacter.ESC, this.get7BitCode()]), this.controlType, C1Mode.BIT_7);
    }
    // Static helper methods
    static create(controlType, mode = C1Mode.BIT_7) {
        const control = C1Control[controlType];
        const raw = mode === C1Mode.BIT_8
            ? new Uint8Array([control[0]])
            : new Uint8Array([ControlCharacter.ESC, control[1]]);
        return new C1ControlSequence(raw, controlType, mode);
    }
    // Helper to detect if a byte is a C1 control
    static isC1Byte(byte) {
        return byte >= 0x80 && byte <= 0x9f;
    }
    // Helper to convert a C1 byte to its 7-bit equivalent
    static convertToEscSequence(byte) {
        if (!this.isC1Byte(byte))
            return null;
        const escByte = byte - 0x40;
        return [ControlCharacter.ESC, escByte];
    }
}
