import { SequenceType, ControlCharacter, } from "./Command.js";
export class VT100DebugFormatter {
    static formatSequences(sequences) {
        if (!sequences.length) {
            return ["(no sequences)"];
        }
        return sequences.map((seq, i) => {
            // Handle text sequences
            if (this.isTextSequence(seq)) {
                return `${(i + 1).toString().padStart(2, " ")}. TEXT "${this.escapeText(seq.text)}"`;
            }
            // Format control sequences as before
            const type = this.getSequenceType(seq.type);
            const rawBytes = this.formatRawBytes(seq.raw);
            const params = this.formatParameters(seq);
            const final = this.formatFinalByte(seq);
            return `${(i + 1)
                .toString()
                .padStart(2, " ")}. ${type} [${rawBytes}]${params}${final}`;
        });
    }
    static isTextSequence(seq) {
        return seq.type === SequenceType.TEXT;
    }
    static escapeText(text) {
        return text
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t")
            .replace(/\v/g, "\\v")
            .replace(/\f/g, "\\f")
            .replace(/\0/g, "\\0");
    }
    static getSequenceType(type) {
        const types = {
            [SequenceType.C0]: "C0",
            [SequenceType.C1]: "C1",
            [SequenceType.CSI]: "CSI",
            [SequenceType.DCS]: "DCS",
            [SequenceType.OSC]: "OSC",
            [SequenceType.PM]: "PM",
            [SequenceType.APC]: "APC",
            [SequenceType.ESCAPE]: "ESCAPE",
            [SequenceType.TEXT]: "TEXT",
            [SequenceType.UNKNOWN]: "UNKNOWN",
        };
        return types[type] || "Unknown";
    }
    static formatRawBytes(raw) {
        return Array.from(raw)
            .map((b) => {
            if (b === ControlCharacter.ESC)
                return "ESC";
            if (b >= 32 && b <= 126)
                return String.fromCharCode(b);
            return `0x${b.toString(16).padStart(2, "0")}`;
        })
            .join(" ");
    }
    static formatParameters(seq) {
        if (!("parameters" in seq))
            return "";
        const params = seq.parameters;
        if (!params?.length)
            return "";
        const paramStr = params
            .map((p) => {
            if (p.value === null || p.value === undefined)
                return "";
            return p.private ? `?${p.value}` : `${p.value}`;
        })
            .filter(Boolean)
            .join(";");
        return paramStr ? ` params:[${paramStr}]` : "";
    }
    static formatFinalByte(seq) {
        if (!("finalByte" in seq))
            return "";
        const finalByte = seq.finalByte;
        if (!finalByte)
            return "";
        return ` final:${String.fromCharCode(finalByte)}(0x${finalByte.toString(16)})`;
    }
}
