import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";
// Enum for common simple escape sequences final bytes
// This helps with type checking and documentation
var SimpleEscapeCommand;
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
}
