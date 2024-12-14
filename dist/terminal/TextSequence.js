import { VT100Sequence, SequenceType, ControlCharacter } from "./Command.js";
export class TextSequence extends VT100Sequence {
    constructor(raw, text) {
        super(SequenceType.TEXT, ControlCharacter.NUL, raw);
        this.raw = raw;
        this.text = text;
        this.type = SequenceType.TEXT;
        this.controlChar = ControlCharacter.NUL; // or perhaps undefined
    }
    static fromStr(text) {
        const encoder = new TextEncoder();
        const raw = encoder.encode(text);
        return new TextSequence(raw, text);
    }
    isValid() {
        return true;
    }
    toString() {
        return this.text;
    }
}
