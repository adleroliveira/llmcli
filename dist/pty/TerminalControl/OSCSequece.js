import { VT100Sequence, ControlCharacter, SequenceType, } from "./Command.js";
export class OSCSequence extends VT100Sequence {
    constructor(raw, stringContent, terminator) {
        super(SequenceType.OSC, ControlCharacter.OSC, raw);
        this.stringContent = stringContent;
        this.terminator = terminator;
    }
    isValid() {
        // OSC specific validation
        return (this.stringContent.length > 0 &&
            (this.terminator === ControlCharacter.ST ||
                this.terminator === ControlCharacter.BEL));
    }
    toString() {
        return `\x1B]${this.stringContent}${String.fromCharCode(this.terminator)}`;
    }
}
