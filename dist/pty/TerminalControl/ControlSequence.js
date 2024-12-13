import { VT100Sequence, SequenceType, ControlCharacter } from "./Command.js";
export class ControlSequence extends VT100Sequence {
    constructor(controlChar, repeat = 1) {
        super(SequenceType.C0, controlChar, new Uint8Array([controlChar]) // controlChar is already a number
        );
        this.controlChar = controlChar;
        this.repeat = repeat;
    }
    isValid() {
        return this.raw[0] <= 0x1F || this.raw[0] === 0x7F; // Valid C0 range plus DEL
    }
    toString() {
        // Convert the control character to a string and repeat it
        return String.fromCharCode(this.controlChar).repeat(this.repeat);
    }
    // Helper methods for common C0 control characters
    static backspace(count = 1) {
        return new ControlSequence(ControlCharacter.BS, count);
    }
    static bell() {
        return new ControlSequence(ControlCharacter.BEL);
    }
    static tab(count = 1) {
        return new ControlSequence(ControlCharacter.HT, count);
    }
    static lineFeed(count = 1) {
        return new ControlSequence(ControlCharacter.LF, count);
    }
    static carriageReturn() {
        return new ControlSequence(ControlCharacter.CR);
    }
}
