import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";
// Enum for common simple escape sequences final bytes
// This helps with type checking and documentation
export var SimpleEscapeCommand;
(function (SimpleEscapeCommand) {
    SimpleEscapeCommand["RIS"] = "c";
    SimpleEscapeCommand["DECSC"] = "7";
    SimpleEscapeCommand["DECRC"] = "8";
    SimpleEscapeCommand["IND"] = "D";
    SimpleEscapeCommand["NEL"] = "E";
    SimpleEscapeCommand["HTS"] = "H";
    SimpleEscapeCommand["RI"] = "M";
    SimpleEscapeCommand["SS2"] = "N";
    SimpleEscapeCommand["SS3"] = "O";
    SimpleEscapeCommand["DECPAM"] = "=";
    SimpleEscapeCommand["DECPNM"] = ">";
})(SimpleEscapeCommand || (SimpleEscapeCommand = {}));
export class SimpleEscapeSequence extends VT100Sequence {
    constructor(raw, finalByte) {
        super(SequenceType.ESCAPE, ControlCharacter.ESC, raw);
        this.finalByte = finalByte;
    }
    isValid() {
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
        return (this.finalByte >= 0x30 &&
            this.finalByte <= 0x7e &&
            !invalidFollowers.includes(finalChar));
    }
    toString() {
        return `\x1B${String.fromCharCode(this.finalByte)}`;
    }
    // Helper method to get the command type if it's a known command
    getCommandType() {
        const finalChar = String.fromCharCode(this.finalByte);
        return Object.values(SimpleEscapeCommand).includes(finalChar)
            ? finalChar
            : null;
    }
    // Static helper to create common sequences
    static create(command) {
        return new SimpleEscapeSequence(new Uint8Array([ControlCharacter.ESC, command.charCodeAt(0)]), command.charCodeAt(0));
    }
    // Create from raw bytes
    static from(bytes) {
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
    static fromStr(text) {
        // Verify the string starts with ESC
        if (!text.startsWith("\x1B")) {
            throw new Error("Invalid Simple Escape sequence string: must start with ESC");
        }
        // For simple escape sequences, we expect exactly two characters: ESC + final byte
        if (text.length !== 2) {
            throw new Error("Invalid Simple Escape sequence string: incorrect length");
        }
        // Convert to bytes
        const bytes = new Uint8Array([ControlCharacter.ESC, text.charCodeAt(1)]);
        return this.from(bytes);
    }
}
