import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";
// Character set designators
export var CharsetDesignator;
(function (CharsetDesignator) {
    CharsetDesignator["G0"] = "(";
    CharsetDesignator["G1"] = ")";
    CharsetDesignator["G2"] = "*";
    CharsetDesignator["G3"] = "+";
})(CharsetDesignator || (CharsetDesignator = {}));
// Standard character sets
var CharacterSet;
(function (CharacterSet) {
    CharacterSet["USASCII"] = "B";
    CharacterSet["UK"] = "A";
    CharacterSet["SpecialGraphics"] = "0";
    CharacterSet["AlternateROM"] = "1";
    CharacterSet["AlternateROMS"] = "2";
    CharacterSet["Dutch"] = "4";
    CharacterSet["Finnish"] = "C";
    CharacterSet["French"] = "R";
    CharacterSet["FrenchCanadian"] = "Q";
    CharacterSet["German"] = "K";
    CharacterSet["Italian"] = "Y";
    CharacterSet["Norwegian"] = "`";
    CharacterSet["Spanish"] = "Z";
    CharacterSet["Swedish"] = "H";
    CharacterSet["Swiss"] = "=";
})(CharacterSet || (CharacterSet = {}));
export class CharsetSequence extends VT100Sequence {
    constructor(raw, designator, charset) {
        super(SequenceType.ESCAPE, ControlCharacter.ESC, raw);
        this.designator = designator;
        this.charset = charset;
    }
    isValid() {
        // Validation rules:
        // 1. Designator must be valid
        // 2. Charset must be a valid final byte
        // 3. Specific combinations might be invalid for certain terminals
        const isValidDesignator = Object.values(CharsetDesignator).includes(String.fromCharCode(this.designator.charCodeAt(0)));
        const charsetChar = String.fromCharCode(this.charset);
        const isValidCharset = Object.values(CharacterSet).includes(charsetChar) ||
            this.isCustomCharset();
        return isValidDesignator && isValidCharset;
    }
    isCustomCharset() {
        // Some terminals support additional character sets
        // This method can be extended for terminal-specific implementations
        const code = this.charset;
        return (code >= 0x30 &&
            code <= 0x7e && // Valid final byte range
            !Object.values(CharacterSet).includes(String.fromCharCode(code)));
    }
    toString() {
        return `\x1B${this.designator}${String.fromCharCode(this.charset)}`;
    }
    // Helper method to get the standard charset type if it's a known charset
    getCharsetType() {
        const charsetChar = String.fromCharCode(this.charset);
        return Object.values(CharacterSet).includes(charsetChar)
            ? charsetChar
            : null;
    }
    // Helper method to determine if this is a graphics set
    isGraphicsSet() {
        const charset = this.getCharsetType();
        return (charset === CharacterSet.SpecialGraphics ||
            charset === CharacterSet.AlternateROMS);
    }
    // Static helper to create common charset sequences
    static createG0(charset) {
        return new CharsetSequence(new Uint8Array([
            ControlCharacter.ESC,
            CharsetDesignator.G0.charCodeAt(0),
            charset.charCodeAt(0),
        ]), CharsetDesignator.G0, charset.charCodeAt(0));
    }
    static createG1(charset) {
        return new CharsetSequence(new Uint8Array([
            ControlCharacter.ESC,
            CharsetDesignator.G1.charCodeAt(0),
            charset.charCodeAt(0),
        ]), CharsetDesignator.G1, charset.charCodeAt(0));
    }
}
