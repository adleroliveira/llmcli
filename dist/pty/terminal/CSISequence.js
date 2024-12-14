import { VT100Sequence, ControlCharacter, SequenceType, } from "./Command.js";
export var CSICommand;
(function (CSICommand) {
    // Cursor commands
    CSICommand["CUU"] = "A";
    CSICommand["CUD"] = "B";
    CSICommand["CUF"] = "C";
    CSICommand["CUB"] = "D";
    CSICommand["CNL"] = "E";
    CSICommand["CPL"] = "F";
    CSICommand["CHA"] = "G";
    CSICommand["CUP"] = "H";
    CSICommand["VPA"] = "d";
    CSICommand["CHT"] = "I";
    CSICommand["CBT"] = "Z";
    CSICommand["DSR"] = "n";
    // Erase commands
    CSICommand["ED"] = "J";
    CSICommand["EL"] = "K";
    // Screen commands
    CSICommand["SU"] = "S";
    CSICommand["SD"] = "T";
    CSICommand["DECSTBM"] = "r";
    // Mode commands
    CSICommand["SM"] = "h";
    CSICommand["RM"] = "l";
    // Other commands
    CSICommand["SGR"] = "m";
    CSICommand["SCOSC"] = "s";
    CSICommand["SCORC"] = "u";
    // Window commands
    CSICommand["XTWINOPS"] = "t";
    // Erase/Delete commands
    CSICommand["DCH"] = "P";
    CSICommand["DL"] = "M";
    CSICommand["ICH"] = "@";
    CSICommand["IL"] = "L";
    // Screen commands
    CSICommand["DECSLRM"] = "s";
    CSICommand["DECALN"] = "#8";
})(CSICommand || (CSICommand = {}));
export var SGRAttribute;
(function (SGRAttribute) {
    SGRAttribute[SGRAttribute["Reset"] = 0] = "Reset";
    SGRAttribute[SGRAttribute["Bold"] = 1] = "Bold";
    SGRAttribute[SGRAttribute["Dim"] = 2] = "Dim";
    SGRAttribute[SGRAttribute["Italic"] = 3] = "Italic";
    SGRAttribute[SGRAttribute["Underline"] = 4] = "Underline";
    SGRAttribute[SGRAttribute["BlinkSlow"] = 5] = "BlinkSlow";
    SGRAttribute[SGRAttribute["BlinkRapid"] = 6] = "BlinkRapid";
    SGRAttribute[SGRAttribute["Inverse"] = 7] = "Inverse";
    SGRAttribute[SGRAttribute["Hidden"] = 8] = "Hidden";
    SGRAttribute[SGRAttribute["StrikeThrough"] = 9] = "StrikeThrough";
    // Reset individual attributes
    SGRAttribute[SGRAttribute["BoldOff"] = 22] = "BoldOff";
    SGRAttribute[SGRAttribute["ItalicOff"] = 23] = "ItalicOff";
    SGRAttribute[SGRAttribute["UnderlineOff"] = 24] = "UnderlineOff";
    SGRAttribute[SGRAttribute["BlinkOff"] = 25] = "BlinkOff";
    SGRAttribute[SGRAttribute["InverseOff"] = 27] = "InverseOff";
    SGRAttribute[SGRAttribute["StrikeThroughOff"] = 29] = "StrikeThroughOff";
})(SGRAttribute || (SGRAttribute = {}));
// Standard 16-color support
export var SGRColor;
(function (SGRColor) {
    // Foreground colors
    SGRColor[SGRColor["Black"] = 30] = "Black";
    SGRColor[SGRColor["Red"] = 31] = "Red";
    SGRColor[SGRColor["Green"] = 32] = "Green";
    SGRColor[SGRColor["Yellow"] = 33] = "Yellow";
    SGRColor[SGRColor["Blue"] = 34] = "Blue";
    SGRColor[SGRColor["Magenta"] = 35] = "Magenta";
    SGRColor[SGRColor["Cyan"] = 36] = "Cyan";
    SGRColor[SGRColor["White"] = 37] = "White";
    SGRColor[SGRColor["Default"] = 39] = "Default";
    // Background colors
    SGRColor[SGRColor["BgBlack"] = 40] = "BgBlack";
    SGRColor[SGRColor["BgRed"] = 41] = "BgRed";
    SGRColor[SGRColor["BgGreen"] = 42] = "BgGreen";
    SGRColor[SGRColor["BgYellow"] = 43] = "BgYellow";
    SGRColor[SGRColor["BgBlue"] = 44] = "BgBlue";
    SGRColor[SGRColor["BgMagenta"] = 45] = "BgMagenta";
    SGRColor[SGRColor["BgCyan"] = 46] = "BgCyan";
    SGRColor[SGRColor["BgWhite"] = 47] = "BgWhite";
    SGRColor[SGRColor["BgDefault"] = 49] = "BgDefault";
    // Bright foreground colors
    SGRColor[SGRColor["BrightBlack"] = 90] = "BrightBlack";
    SGRColor[SGRColor["BrightRed"] = 91] = "BrightRed";
    SGRColor[SGRColor["BrightGreen"] = 92] = "BrightGreen";
    SGRColor[SGRColor["BrightYellow"] = 93] = "BrightYellow";
    SGRColor[SGRColor["BrightBlue"] = 94] = "BrightBlue";
    SGRColor[SGRColor["BrightMagenta"] = 95] = "BrightMagenta";
    SGRColor[SGRColor["BrightCyan"] = 96] = "BrightCyan";
    SGRColor[SGRColor["BrightWhite"] = 97] = "BrightWhite";
    // Bright background colors
    SGRColor[SGRColor["BgBrightBlack"] = 100] = "BgBrightBlack";
    SGRColor[SGRColor["BgBrightRed"] = 101] = "BgBrightRed";
    SGRColor[SGRColor["BgBrightGreen"] = 102] = "BgBrightGreen";
    SGRColor[SGRColor["BgBrightYellow"] = 103] = "BgBrightYellow";
    SGRColor[SGRColor["BgBrightBlue"] = 104] = "BgBrightBlue";
    SGRColor[SGRColor["BgBrightMagenta"] = 105] = "BgBrightMagenta";
    SGRColor[SGRColor["BgBrightCyan"] = 106] = "BgBrightCyan";
    SGRColor[SGRColor["BgBrightWhite"] = 107] = "BgBrightWhite";
})(SGRColor || (SGRColor = {}));
export class TextFormatter {
    static createSGR(...params) {
        return CSISequence.create(CSICommand.SGR, params).toString();
    }
    static rgb(r, g, b, isBackground = false) {
        const prefix = isBackground ? 48 : 38;
        return this.createSGR(prefix, 2, r, g, b);
    }
    static color256(code, isBackground = false) {
        const prefix = isBackground ? 48 : 38;
        return this.createSGR(prefix, 5, code);
    }
}
export class CSISequence extends VT100Sequence {
    constructor(raw, parameters, intermediateBytes, finalByte) {
        super(SequenceType.CSI, ControlCharacter.CSI, raw);
        this.parameters = parameters;
        this.intermediateBytes = intermediateBytes;
        this.finalByte = finalByte;
    }
    static create(command, params = [], isPrivate = false) {
        // Convert params to Parameter array
        const parameters = params.map(value => ({
            value,
            private: isPrivate
        }));
        // Build the raw byte sequence
        const bytes = [];
        // Add parameter bytes
        if (isPrivate) {
            bytes.push(0x3f); // '?'
        }
        // Add parameter values and separators
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
        // Add final byte
        bytes.push(command.charCodeAt(0));
        // Create the sequence
        return new CSISequence(new Uint8Array(bytes), parameters, [], // No intermediate bytes
        command.charCodeAt(0));
    }
    isValid() {
        return (this.isFinalByte(this.finalByte) &&
            this.intermediateBytes.every((b) => this.isIntermediateByte(b)));
    }
    toString() {
        const params = this.parameters
            .map((p) => {
            // Handle null value case
            const paramValue = p.value === null ? "" : p.value.toString();
            return p.private ? `?${paramValue}` : paramValue;
        })
            .join(";");
        const intermediate = String.fromCharCode(...this.intermediateBytes);
        return `\x1B[${params}${intermediate}${String.fromCharCode(this.finalByte)}`;
    }
    static isCursorVisibilityCommand(sequence) {
        return ((sequence.finalByte === 0x68 || sequence.finalByte === 0x6c) && // 'h' or 'l'
            sequence.parameters[0]?.value === 25);
    }
    static isIntermediateByte(byte) {
        return byte >= 0x20 && byte <= 0x2f;
    }
    static isFinalByte(byte) {
        return byte >= 0x40 && byte <= 0x7e;
    }
    static parseParameters(bytes, startIndex, endIndex) {
        const params = [];
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
    static from(bytes) {
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
        const intermediateBytes = [];
        let parameterEndIndex = 0;
        for (let i = 0; i < finalByteIndex; i++) {
            if (this.isIntermediateByte(bytes[i])) {
                intermediateBytes.push(bytes[i]);
            }
            else {
                parameterEndIndex = i + 1;
            }
        }
        // Parse parameters
        const parameters = this.parseParameters(bytes, 0, parameterEndIndex);
        // Create new instance
        const sequence = new CSISequence(bytes, parameters, intermediateBytes, bytes[finalByteIndex]);
        if (!sequence.isValid()) {
            throw new Error("Invalid CSI sequence: validation failed");
        }
        return sequence;
    }
    static fromStr(text) {
        // Convert escaped sequence to bytes
        const bytes = [];
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
    get command() {
        const commandMap = {
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
    includesParam(value) {
        return this.parameters.some((param) => param.value === value);
    }
}
CSISequence.isCursorCommand = (sequence) => {
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
CSISequence.isSgrCommand = (sequence) => {
    const finalByte = sequence.finalByte;
    return finalByte === 0x6d; // 'm' - Select Graphic Rendition
};
CSISequence.isEraseCommand = (sequence) => {
    const finalByte = sequence.finalByte;
    return [
        0x4a, // 'J' - Erase in Display
        0x4b, // 'K' - Erase in Line
    ].includes(finalByte);
};
CSISequence.isScreenCommand = (sequence) => {
    const finalByte = sequence.finalByte;
    return [
        0x72, // 'r' - Set Scrolling Region
        0x53, // 'S' - Scroll Up
        0x54, // 'T' - Scroll Down
    ].includes(finalByte);
};
CSISequence.isModeCommand = (sequence) => {
    const finalByte = sequence.finalByte;
    return [
        0x68, // 'h' - Set Mode
        0x6c, // 'l' - Reset Mode
    ].includes(finalByte);
};
