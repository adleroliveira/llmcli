import {
  VT100Sequence,
  ControlCharacter,
  SequenceType,
  StringSequence,
} from "./Command.js";

export class OSCSequence extends VT100Sequence implements StringSequence {
  constructor(
    raw: Uint8Array,
    public readonly stringContent: string,
    public readonly terminator: ControlCharacter.ST | ControlCharacter.BEL
  ) {
    super(SequenceType.OSC, ControlCharacter.OSC, raw);
  }

  isValid(): boolean {
    // OSC specific validation
    return (
      this.stringContent.length > 0 &&
      (this.terminator === ControlCharacter.ST ||
        this.terminator === ControlCharacter.BEL)
    );
  }

  toString(): string {
    return `\x1B]${this.stringContent}${String.fromCharCode(this.terminator)}`;
  }
}
