import { VT100Sequence, SequenceType, ControlCharacter } from "./Command.js";

export class TextSequence extends VT100Sequence {
  readonly type = SequenceType.TEXT;
  readonly controlChar = ControlCharacter.NUL; // or perhaps undefined

  constructor(public readonly raw: Uint8Array, public readonly text: string) {
    super(SequenceType.TEXT, ControlCharacter.NUL, raw);
  }

  isValid(): boolean {
    return true;
  }

  toString(): string {
    return this.text;
  }
}
