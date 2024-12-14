import { VT100Sequence, SequenceType, ControlCharacter } from "./Command.js";

export class TextSequence extends VT100Sequence {
  readonly type = SequenceType.TEXT;
  readonly controlChar = ControlCharacter.NUL; // or perhaps undefined

  constructor(public readonly raw: Uint8Array, public readonly text: string) {
    super(SequenceType.TEXT, ControlCharacter.NUL, raw);
  }

  static fromStr(text: string): TextSequence {
    const encoder = new TextEncoder();
    const raw = encoder.encode(text);
    return new TextSequence(raw, text);
  }

  isValid(): boolean {
    return true;
  }

  toString(): string {
    return this.text;
  }
}
