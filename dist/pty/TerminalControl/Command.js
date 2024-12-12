// Extended control character set
export var ControlCharacter;
(function (ControlCharacter) {
    // C0 controls (0x00-0x1F)
    ControlCharacter[ControlCharacter["NUL"] = 0] = "NUL";
    ControlCharacter[ControlCharacter["SOH"] = 1] = "SOH";
    ControlCharacter[ControlCharacter["STX"] = 2] = "STX";
    ControlCharacter[ControlCharacter["ETX"] = 3] = "ETX";
    ControlCharacter[ControlCharacter["EOT"] = 4] = "EOT";
    ControlCharacter[ControlCharacter["ENQ"] = 5] = "ENQ";
    ControlCharacter[ControlCharacter["ACK"] = 6] = "ACK";
    ControlCharacter[ControlCharacter["BEL"] = 7] = "BEL";
    ControlCharacter[ControlCharacter["BS"] = 8] = "BS";
    ControlCharacter[ControlCharacter["HT"] = 9] = "HT";
    ControlCharacter[ControlCharacter["LF"] = 10] = "LF";
    ControlCharacter[ControlCharacter["VT"] = 11] = "VT";
    ControlCharacter[ControlCharacter["FF"] = 12] = "FF";
    ControlCharacter[ControlCharacter["CR"] = 13] = "CR";
    ControlCharacter[ControlCharacter["SO"] = 14] = "SO";
    ControlCharacter[ControlCharacter["SI"] = 15] = "SI";
    ControlCharacter[ControlCharacter["DLE"] = 16] = "DLE";
    ControlCharacter[ControlCharacter["DC1"] = 17] = "DC1";
    ControlCharacter[ControlCharacter["DC2"] = 18] = "DC2";
    ControlCharacter[ControlCharacter["DC3"] = 19] = "DC3";
    ControlCharacter[ControlCharacter["DC4"] = 20] = "DC4";
    ControlCharacter[ControlCharacter["NAK"] = 21] = "NAK";
    ControlCharacter[ControlCharacter["SYN"] = 22] = "SYN";
    ControlCharacter[ControlCharacter["ETB"] = 23] = "ETB";
    ControlCharacter[ControlCharacter["CAN"] = 24] = "CAN";
    ControlCharacter[ControlCharacter["EM"] = 25] = "EM";
    ControlCharacter[ControlCharacter["SUB"] = 26] = "SUB";
    ControlCharacter[ControlCharacter["ESC"] = 27] = "ESC";
    ControlCharacter[ControlCharacter["FS"] = 28] = "FS";
    ControlCharacter[ControlCharacter["GS"] = 29] = "GS";
    ControlCharacter[ControlCharacter["RS"] = 30] = "RS";
    ControlCharacter[ControlCharacter["US"] = 31] = "US";
    ControlCharacter[ControlCharacter["DEL"] = 127] = "DEL";
    // C1 controls (8-bit form, 0x80-0x9F)
    ControlCharacter[ControlCharacter["PAD"] = 128] = "PAD";
    ControlCharacter[ControlCharacter["HOP"] = 129] = "HOP";
    ControlCharacter[ControlCharacter["BPH"] = 130] = "BPH";
    ControlCharacter[ControlCharacter["NBH"] = 131] = "NBH";
    ControlCharacter[ControlCharacter["IND"] = 132] = "IND";
    ControlCharacter[ControlCharacter["NEL"] = 133] = "NEL";
    ControlCharacter[ControlCharacter["SSA"] = 134] = "SSA";
    ControlCharacter[ControlCharacter["ESA"] = 135] = "ESA";
    ControlCharacter[ControlCharacter["HTS"] = 136] = "HTS";
    ControlCharacter[ControlCharacter["HTJ"] = 137] = "HTJ";
    ControlCharacter[ControlCharacter["VTS"] = 138] = "VTS";
    ControlCharacter[ControlCharacter["PLD"] = 139] = "PLD";
    ControlCharacter[ControlCharacter["PLU"] = 140] = "PLU";
    ControlCharacter[ControlCharacter["RI"] = 141] = "RI";
    ControlCharacter[ControlCharacter["SS2"] = 142] = "SS2";
    ControlCharacter[ControlCharacter["SS3"] = 143] = "SS3";
    ControlCharacter[ControlCharacter["DCS"] = 144] = "DCS";
    ControlCharacter[ControlCharacter["PU1"] = 145] = "PU1";
    ControlCharacter[ControlCharacter["PU2"] = 146] = "PU2";
    ControlCharacter[ControlCharacter["STS"] = 147] = "STS";
    ControlCharacter[ControlCharacter["CCH"] = 148] = "CCH";
    ControlCharacter[ControlCharacter["MW"] = 149] = "MW";
    ControlCharacter[ControlCharacter["SPA"] = 150] = "SPA";
    ControlCharacter[ControlCharacter["EPA"] = 151] = "EPA";
    ControlCharacter[ControlCharacter["SOS"] = 152] = "SOS";
    ControlCharacter[ControlCharacter["SGC"] = 153] = "SGC";
    ControlCharacter[ControlCharacter["SCI"] = 154] = "SCI";
    ControlCharacter[ControlCharacter["CSI"] = 155] = "CSI";
    ControlCharacter[ControlCharacter["ST"] = 156] = "ST";
    ControlCharacter[ControlCharacter["OSC"] = 157] = "OSC";
    ControlCharacter[ControlCharacter["PM"] = 158] = "PM";
    ControlCharacter[ControlCharacter["APC"] = 159] = "APC";
})(ControlCharacter || (ControlCharacter = {}));
// Sequence types for classification
export var SequenceType;
(function (SequenceType) {
    SequenceType[SequenceType["C0"] = 0] = "C0";
    SequenceType[SequenceType["C1"] = 1] = "C1";
    SequenceType[SequenceType["CSI"] = 2] = "CSI";
    SequenceType[SequenceType["DCS"] = 3] = "DCS";
    SequenceType[SequenceType["OSC"] = 4] = "OSC";
    SequenceType[SequenceType["PM"] = 5] = "PM";
    SequenceType[SequenceType["APC"] = 6] = "APC";
    SequenceType[SequenceType["ESCAPE"] = 7] = "ESCAPE";
    SequenceType[SequenceType["TEXT"] = 8] = "TEXT";
    SequenceType[SequenceType["UNKNOWN"] = 9] = "UNKNOWN";
    SequenceType[SequenceType["SGR"] = 10] = "SGR";
    SequenceType[SequenceType["MOUSE"] = 11] = "MOUSE";
    SequenceType[SequenceType["CHARSET"] = 12] = "CHARSET";
    SequenceType[SequenceType["MODE"] = 13] = "MODE";
})(SequenceType || (SequenceType = {}));
// Utility type for mouse encoding modes
export var MouseEncoding;
(function (MouseEncoding) {
    MouseEncoding[MouseEncoding["DEFAULT"] = 0] = "DEFAULT";
    MouseEncoding[MouseEncoding["SGR"] = 1] = "SGR";
    MouseEncoding[MouseEncoding["URXVT"] = 2] = "URXVT";
    MouseEncoding[MouseEncoding["UTF8"] = 3] = "UTF8";
})(MouseEncoding || (MouseEncoding = {}));
// Charset types
export var CharacterSet;
(function (CharacterSet) {
    CharacterSet[CharacterSet["ASCII"] = 0] = "ASCII";
    CharacterSet[CharacterSet["UK"] = 1] = "UK";
    CharacterSet[CharacterSet["SPECIAL"] = 2] = "SPECIAL";
    CharacterSet[CharacterSet["ALT"] = 3] = "ALT";
    CharacterSet[CharacterSet["ALT_SPECIAL"] = 4] = "ALT_SPECIAL";
})(CharacterSet || (CharacterSet = {}));
// Base abstract class with common functionality
export class VT100Sequence {
    constructor(type, controlChar, raw) {
        this.type = type;
        this.controlChar = controlChar;
        this.raw = raw;
    }
    // Common validation methods
    isIntermediateByte(byte) {
        return byte >= 0x20 && byte <= 0x2f;
    }
    isFinalByte(byte) {
        return byte >= 0x40 && byte <= 0x7e;
    }
    isParameterByte(byte) {
        return byte >= 0x30 && byte <= 0x3f; // includes digits, ;:<?=
    }
}
