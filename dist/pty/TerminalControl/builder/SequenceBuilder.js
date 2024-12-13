export class SequenceBuilder {
    constructor() {
        this.sequences = [];
    }
    static create() {
        return new SequenceBuilder();
    }
    add(producer) {
        this.sequences.push(producer);
        return this;
    }
    build() {
        return this.sequences
            .map(producer => producer.toSequence().toString())
            .join('');
    }
}
