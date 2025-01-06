import { ANSISequence } from "../Command.js";

export interface SequenceProducer {
  toSequence(): ANSISequence;
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
      .map((producer) => producer.toSequence().toString())
      .join("");
  }

  clear(): void {
    this.sequences = [];
  }

  addAll(sequences: SequenceProducer[]): this {
    sequences.forEach((sequence) => this.add(sequence));
    return this;
  }
}
