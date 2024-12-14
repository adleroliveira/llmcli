import { SequenceType } from "./Command.js";
import { CSISequence, CSICommand } from "./CSISequence.js";
import { TextSequence } from "./TextSequence.js";
export class ViewPort {
    constructor(config) {
        this.width = config.dimensions.width;
        this.height = config.dimensions.height;
        this.x = config.position.x;
        this.y = config.position.y;
        this.cursor = { x: 0, y: 0 };
    }
    getDimensions() {
        return { width: this.width, height: this.height };
    }
    getPosition() {
        return { x: this.x, y: this.y };
    }
    setPosition(position) {
        this.x = position.x;
        this.y = position.y;
    }
    resize(dimensions) {
        this.width = dimensions.width;
        this.height = dimensions.height;
    }
    process(sequence) {
        const sequences = this.splitSequence(sequence);
        const result = [];
        for (const seq of sequences) {
            // Transform each sequence
            const transformed = this.transformSequence(seq);
            result.push(...transformed);
            // Update internal cursor after transformation
            this.updateInternalCursor(seq);
        }
        return result;
    }
    splitSequence(sequence) {
        if (sequence.type !== SequenceType.TEXT) {
            return [sequence];
        }
        const text = sequence.toString();
        const result = [];
        let currentText = "";
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === "\r" || char === "\n") {
                // Push accumulated text if any
                if (currentText) {
                    result.push(TextSequence.fromStr(currentText));
                    currentText = "";
                }
                // Push control character as C0 sequence
                result.push(TextSequence.fromStr(char));
            }
            else {
                currentText += char;
            }
        }
        // Push any remaining text
        if (currentText) {
            result.push(TextSequence.fromStr(currentText));
        }
        return result;
    }
    updateInternalCursor(sequence) {
        if (sequence.type === SequenceType.CSI) {
            const csiSeq = sequence;
            switch (csiSeq.command) {
                case CSICommand.CUP:
                    if (csiSeq.parameters.length >= 2) {
                        const row = (csiSeq.parameters[0].value ?? 1) - 1 - this.y;
                        const col = (csiSeq.parameters[1].value ?? 1) - 1 - this.x;
                        this.cursor.y = Math.min(Math.max(0, row), this.height - 1);
                        this.cursor.x = Math.min(Math.max(0, col), this.width - 1);
                    }
                    break;
            }
        }
        else if (sequence.type === SequenceType.C0 ||
            sequence.type === SequenceType.TEXT) {
            const text = sequence.toString();
            if (text === "\r") {
                this.cursor.x = 0;
            }
            else if (text === "\n") {
                this.cursor.y = Math.min(this.cursor.y + 1, this.height - 1);
            }
            else if (sequence.type === SequenceType.TEXT) {
                this.cursor.x += text.length;
                if (this.cursor.x >= this.width) {
                    this.cursor.x = this.width - 1;
                }
            }
        }
    }
    transformSequence(sequence) {
        switch (sequence.type) {
            case SequenceType.CSI:
                return [this.transformCSISequence(sequence)];
            case SequenceType.C0:
            case SequenceType.TEXT:
                const char = sequence.toString();
                if (char === "\r") {
                    // Move to beginning of current line within viewport
                    return [
                        CSISequence.create(CSICommand.CUP, [
                            this.cursor.y + this.y + 1,
                            this.x + 1,
                        ]),
                    ];
                }
                else if (char === "\n") {
                    // Just move cursor to the start of next line
                    return [
                        CSISequence.create(CSICommand.CUP, [
                            this.cursor.y + this.y + 2,
                            this.x + 1,
                        ]),
                    ];
                }
                else if (sequence.type === SequenceType.TEXT) {
                    // For regular text, if we're at the start of a line, position cursor first
                    const result = [];
                    if (this.cursor.x === 0) {
                        result.push(CSISequence.create(CSICommand.CUP, [
                            this.cursor.y + this.y + 1,
                            this.x + 1,
                        ]));
                    }
                    result.push(sequence);
                    return result;
                }
                return [sequence];
            default:
                return [sequence];
        }
    }
    transformCSISequence(sequence) {
        const processed = CSISequence.fromStr(sequence.toString());
        switch (sequence.command) {
            case CSICommand.CUP:
                if (processed.parameters.length >= 2) {
                    const row = processed.parameters[0].value ?? 1;
                    const col = processed.parameters[1].value ?? 1;
                    // Add viewport offset
                    processed.parameters[0].value = row + this.y;
                    processed.parameters[1].value = col + this.x;
                }
                break;
            case CSICommand.CUU: // Cursor Up
            case CSICommand.CUD: // Cursor Down
            case CSICommand.CUF: // Cursor Forward
            case CSICommand.CUB: // Cursor Back
                // These are relative movements, so they don't need offset adjustment
                // But we do need to constrain them to viewport bounds
                if (processed.parameters.length >= 1 &&
                    processed.parameters[0].value !== null) {
                    const maxMove = this.getMaxMovement(sequence.command);
                    processed.parameters[0].value = Math.min(processed.parameters[0].value, maxMove);
                }
                break;
        }
        return processed;
    }
    getMaxMovement(command) {
        switch (command) {
            case CSICommand.CUU:
                return this.cursor.y;
            case CSICommand.CUD:
                return this.height - this.cursor.y - 1;
            case CSICommand.CUF:
                return this.width - this.cursor.x - 1;
            case CSICommand.CUB:
                return this.cursor.x;
            default:
                return 0;
        }
    }
}