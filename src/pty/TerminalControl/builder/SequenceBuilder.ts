import { VT100Sequence } from "../Command.js";

export interface SequenceProducer {
  toSequence(): VT100Sequence;
}

export class SequenceBuilder {
  private sequences: SequenceProducer[] = [];

  static create(): SequenceBuilder {
    return new SequenceBuilder();
  }

  add(producer: SequenceProducer): this {
    this.sequences.push(producer);
    return this;
  }

  build(): string {
    return this.sequences
      .map(producer => producer.toSequence().toString())
      .join('');
  }
}
