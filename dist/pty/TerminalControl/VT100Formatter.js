import { SequenceType, } from "./Command.js";
export var VerbosityLevel;
(function (VerbosityLevel) {
    VerbosityLevel[VerbosityLevel["MINIMAL"] = 0] = "MINIMAL";
    VerbosityLevel[VerbosityLevel["STANDARD"] = 1] = "STANDARD";
    VerbosityLevel[VerbosityLevel["DETAILED"] = 2] = "DETAILED";
})(VerbosityLevel || (VerbosityLevel = {}));
const DEFAULT_OPTIONS = {
    verbosity: VerbosityLevel.DETAILED,
    showRawBytes: false,
};
export class VT100Formatter {
    static getOSCCommand(raw) {
        // Skip ESC ] at start
        let pos = 2;
        let cmd = "";
        // Read until semicolon or end
        while (pos < raw.length && raw[pos] !== 0x3b) {
            cmd += String.fromCharCode(raw[pos]);
            pos++;
        }
        return cmd;
    }
    static formatText(raw) {
        // First try to decode the entire array as UTF-8
        try {
            // Use TextDecoder for proper UTF-8 decoding
            const decoder = new TextDecoder("utf-8");
            const text = decoder.decode(raw);
            // After decoding, escape only control characters
            return text
                .split("")
                .map((char) => {
                const code = char.charCodeAt(0);
                if (code === 0x0d)
                    return "\\r";
                if (code === 0x0a)
                    return "\\n";
                if (code === 0x09)
                    return "\\t";
                if (code === 0x08)
                    return "\\b";
                if (code === 0x07)
                    return "\\a";
                if (code === 0x0b)
                    return "\\v";
                if (code === 0x0c)
                    return "\\f";
                if (code < 32)
                    return `\\x${code.toString(16).padStart(2, "0")}`;
                return char;
            })
                .join("");
        }
        catch (e) {
            // Fallback to original behavior if UTF-8 decoding fails
            return Array.from(raw)
                .map((byte) => {
                if (byte === 0x0d)
                    return "\\r";
                if (byte === 0x0a)
                    return "\\n";
                if (byte === 0x09)
                    return "\\t";
                if (byte === 0x08)
                    return "\\b";
                if (byte === 0x07)
                    return "\\a";
                if (byte === 0x0b)
                    return "\\v";
                if (byte === 0x0c)
                    return "\\f";
                if (byte === 0x20)
                    return " ";
                if (byte < 32 || byte > 126)
                    return `\\x${byte.toString(16).padStart(2, "0")}`;
                return String.fromCharCode(byte);
            })
                .join("");
        }
    }
    static getCommandDescription(sequence, verbosity = VerbosityLevel.MINIMAL) {
        if (sequence.type === SequenceType.C1 && sequence.raw.length === 1) {
            const controlByte = sequence.raw[0];
            const desc = this.c1ControlDescriptions.get(controlByte);
            if (!desc)
                return `UNK_C1_${controlByte.toString(16)}`;
            return verbosity === VerbosityLevel.MINIMAL ? desc.short : desc.full;
        }
        if (sequence.type === SequenceType.ESCAPE && sequence.raw.length === 2) {
            const command = String.fromCharCode(sequence.raw[1]);
            const desc = this.escapeDescriptions.get(command);
            if (!desc)
                return `UNK_ESC_${command}`;
            return verbosity === VerbosityLevel.MINIMAL ? desc.short : desc.full;
        }
        if (sequence.type === SequenceType.OSC) {
            const cmd = this.getOSCCommand(sequence.raw);
            if (cmd) {
                const desc = this.oscCommandDescriptions.get(cmd);
                if (desc) {
                    return verbosity === VerbosityLevel.MINIMAL ? desc.short : desc.full;
                }
            }
            return `OSC_${cmd || "UNKNOWN"}`;
        }
        const lastByte = sequence.raw[sequence.raw.length - 1];
        const command = String.fromCharCode(lastByte);
        const desc = this.commandDescriptions.get(command);
        if (!desc)
            return `UNK_CMD_${command}`;
        // Check if this is a mode command (h or l) with parameters
        if ((command === "h" || command === "l") &&
            sequence.parameters?.length > 0) {
            const params = sequence.parameters;
            const firstParam = params[0];
            if (firstParam.private) {
                const modeKey = `?${firstParam.value}`;
                const modeDesc = this.modeDescriptions.get(modeKey);
                if (modeDesc) {
                    const baseDesc = verbosity === VerbosityLevel.MINIMAL ? desc.short : desc.full;
                    const modeDescText = verbosity === VerbosityLevel.MINIMAL
                        ? modeDesc.short
                        : modeDesc.full;
                    return `${baseDesc} - ${modeDescText}`;
                }
            }
        }
        return verbosity === VerbosityLevel.MINIMAL ? desc.short : desc.full;
    }
    static formatParameter(param) {
        const parts = [];
        const value = param.value?.toString() || "null";
        if (param.private) {
            parts.push(`?${value}`);
        }
        else {
            parts.push(value);
        }
        if (param.subParameters?.length) {
            parts.push(`:${param.subParameters.join(",")}`);
        }
        return parts.join("");
    }
    static formatParameters(params) {
        if (!params.length)
            return "";
        return params.map((param) => this.formatParameter(param)).join(";");
    }
    static formatOSCData(raw) {
        // Skip ESC ] and command number
        let pos = 2;
        while (pos < raw.length && raw[pos] !== 0x3b)
            pos++;
        pos++; // Skip semicolon
        if (pos >= raw.length)
            return "";
        // Get data until ST or BEL
        let data = "";
        while (pos < raw.length) {
            const byte = raw[pos];
            if (byte === 0x07 || byte === 0x1b)
                break; // BEL or ESC (start of ST)
            data += String.fromCharCode(byte);
            pos++;
        }
        return data;
    }
    static format(sequence, options = {}) {
        const finalOptions = {
            verbosity: options.verbosity ?? DEFAULT_OPTIONS.verbosity,
            showRawBytes: options.showRawBytes ?? DEFAULT_OPTIONS.showRawBytes,
        };
        const typeName = this.sequenceTypeNames.get(sequence.type) ?? "UNKNOWN";
        if (sequence.type === SequenceType.TEXT) {
            const parts = [`TEXT<DATA>"${this.formatText(sequence.raw)}"`];
            if (finalOptions.showRawBytes) {
                const rawBytes = Array.from(sequence.raw)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join(" ");
                parts.push(`(${rawBytes})`);
            }
            return parts.join("");
        }
        const parts = [typeName];
        // Command
        parts.push(`<${this.getCommandDescription(sequence, finalOptions.verbosity)}>`);
        // Parameters
        if (sequence.type === SequenceType.OSC) {
            const data = this.formatOSCData(sequence.raw);
            if (data) {
                parts.push(`[${data}]`);
            }
        }
        else {
            const params = sequence.parameters
                ? this.formatParameters(sequence.parameters)
                : "";
            if (params) {
                parts.push(`[${params}]`);
            }
        }
        // SGR Attributes
        if (sequence.type === SequenceType.SGR) {
            const sgrSeq = sequence;
            const attrs = Object.entries(sgrSeq.attributes)
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}=${value}`)
                .join(",");
            if (attrs) {
                parts.push(`{${attrs}}`);
            }
        }
        // Raw bytes
        if (finalOptions.showRawBytes) {
            const rawBytes = Array.from(sequence.raw)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(" ");
            parts.push(`(${rawBytes})`);
        }
        return parts.join("");
    }
}
VT100Formatter.sequenceTypeNames = new Map(Object.entries(SequenceType)
    .filter(([key]) => isNaN(Number(key)))
    .map(([key, value]) => [value, key]));
VT100Formatter.c1ControlDescriptions = new Map([
    [0x80, { short: "PAD", full: "PAD - Padding Character" }],
    [0x81, { short: "HOP", full: "HOP - High Octet Preset" }],
    [0x82, { short: "BPH", full: "BPH - Break Permitted Here" }],
    [0x83, { short: "NBH", full: "NBH - No Break Here" }],
    [0x84, { short: "IND", full: "IND - Index" }],
    [0x85, { short: "NEL", full: "NEL - Next Line" }],
    [0x86, { short: "SSA", full: "SSA - Start of Selected Area" }],
    [0x87, { short: "ESA", full: "ESA - End of Selected Area" }],
    [0x88, { short: "HTS", full: "HTS - Horizontal Tab Set" }],
    [0x89, { short: "HTJ", full: "HTJ - Horizontal Tab with Justification" }],
    [0x8a, { short: "VTS", full: "VTS - Vertical Tab Set" }],
    [0x8b, { short: "PLD", full: "PLD - Partial Line Forward" }],
    [0x8c, { short: "PLU", full: "PLU - Partial Line Backward" }],
    [0x8d, { short: "RI", full: "RI - Reverse Index" }],
    [0x8e, { short: "SS2", full: "SS2 - Single Shift 2" }],
    [0x8f, { short: "SS3", full: "SS3 - Single Shift 3" }],
    [0x90, { short: "DCS", full: "DCS - Device Control String" }],
    [0x91, { short: "PU1", full: "PU1 - Private Use 1" }],
    [0x92, { short: "PU2", full: "PU2 - Private Use 2" }],
    [0x93, { short: "STS", full: "STS - Set Transmit State" }],
    [0x94, { short: "CCH", full: "CCH - Cancel Character" }],
    [0x95, { short: "MW", full: "MW - Message Waiting" }],
    [0x96, { short: "SPA", full: "SPA - Start of Protected Area" }],
    [0x97, { short: "EPA", full: "EPA - End of Protected Area" }],
    [0x98, { short: "SOS", full: "SOS - Start of String" }],
    [
        0x99,
        { short: "SGCI", full: "SGCI - Single Graphic Character Introducer" },
    ],
    [0x9a, { short: "SCI", full: "SCI - Single Character Introducer" }],
    [0x9b, { short: "CSI", full: "CSI - Control Sequence Introducer" }],
    [0x9c, { short: "ST", full: "ST - String Terminator" }],
    [0x9d, { short: "OSC", full: "OSC - Operating System Command" }],
    [0x9e, { short: "PM", full: "PM - Privacy Message" }],
    [0x9f, { short: "APC", full: "APC - Application Program Command" }],
]);
// Split into short and full descriptions
VT100Formatter.commandDescriptions = new Map([
    ["m", { short: "SGR", full: "SGR - Select Graphic Rendition" }],
    ["h", { short: "SM", full: "SM - Set Mode" }],
    ["l", { short: "RM", full: "RM - Reset Mode" }],
    ["J", { short: "ED", full: "ED - Erase in Display" }],
    ["K", { short: "EL", full: "EL - Erase in Line" }],
    ["H", { short: "CUP", full: "CUP - Cursor Position" }],
    ["A", { short: "CUU", full: "CUU - Cursor Up" }],
    ["B", { short: "CUD", full: "CUD - Cursor Down" }],
    ["C", { short: "CUF", full: "CUF - Cursor Forward" }],
    ["D", { short: "CUB", full: "CUB - Cursor Backward" }],
]);
VT100Formatter.modeDescriptions = new Map([
    ["?1", { short: "App Cursor", full: "Application Cursor Keys" }],
    ["?2004", { short: "Bracket Paste", full: "Bracketed Paste Mode" }],
    ["?25", { short: "Cursor Vis", full: "Show/Hide Cursor" }],
    ["?47", { short: "Alt Buffer", full: "Alternate Screen Buffer" }],
    [
        "?1049",
        {
            short: "Alt Buffer+Cursor",
            full: "Alternate Screen Buffer with Cursor Save",
        },
    ],
]);
VT100Formatter.oscCommandDescriptions = new Map([
    ["0", { short: "SET_TITLE_ICON", full: "Set Window Title and Icon" }],
    ["1", { short: "SET_ICON", full: "Set Icon Name" }],
    ["2", { short: "SET_TITLE", full: "Set Window Title" }],
    ["4", { short: "SET_COLOR", full: "Set/Reset Color" }],
    ["7", { short: "SET_CWD", full: "Set Current Working Directory" }],
    ["8", { short: "SET_HYPERLINK", full: "Set Hyperlink" }],
    ["9", { short: "SET_NOTIFY", full: "Desktop Notification" }],
    ["10", { short: "SET_FOREGROUND", full: "Set Default Foreground Color" }],
    ["11", { short: "SET_BACKGROUND", full: "Set Default Background Color" }],
    [
        "52",
        { short: "COPY_CLIPBOARD", full: "Manipulate Selection/Clipboard Data" },
    ],
    ["104", { short: "RESET_COLOR", full: "Reset Color" }],
    [
        "110",
        { short: "RESET_FOREGROUND", full: "Reset Default Foreground Color" },
    ],
    [
        "111",
        { short: "RESET_BACKGROUND", full: "Reset Default Background Color" },
    ],
]);
VT100Formatter.escapeDescriptions = new Map([
    [
        "=",
        { short: "DECKPAM", full: "DECKPAM - Enable Keypad Application Mode" },
    ],
    [">", { short: "DECKPNM", full: "DECKPNM - Enable Keypad Numeric Mode" }],
    ["7", { short: "DECSC", full: "DECSC - Save Cursor Position" }],
    ["8", { short: "DECRC", full: "DECRC - Restore Cursor Position" }],
    ["D", { short: "IND", full: "IND - Index" }],
    ["E", { short: "NEL", full: "NEL - Next Line" }],
    ["H", { short: "HTS", full: "HTS - Horizontal Tab Set" }],
    ["M", { short: "RI", full: "RI - Reverse Index" }],
    ["N", { short: "SS2", full: "SS2 - Single Shift 2" }],
    ["O", { short: "SS3", full: "SS3 - Single Shift 3" }],
    ["P", { short: "DCS", full: "DCS - Device Control String" }],
    ["V", { short: "SPA", full: "SPA - Start Protected Area" }],
    ["W", { short: "EPA", full: "EPA - End Protected Area" }],
    ["X", { short: "SOS", full: "SOS - Start of String" }],
    ["Z", { short: "DECID", full: "DECID - Return Terminal ID" }],
    ["[", { short: "CSI", full: "CSI - Control Sequence Introducer" }],
    ["\\", { short: "ST", full: "ST - String Terminator" }],
    ["]", { short: "OSC", full: "OSC - Operating System Command" }],
    ["^", { short: "PM", full: "PM - Privacy Message" }],
    ["_", { short: "APC", full: "APC - Application Program Command" }],
]);
