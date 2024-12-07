export class TerminalLexer {
    constructor() {
        this.pos = 0;
        this.input = "";
    }
    *tokenize(input) {
        this.input = input;
        this.pos = 0;
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (char === "\x1B") {
                yield* this.handleEscapeSequence();
            }
            else if (char < " ") {
                yield* this.handleControlCharacter();
            }
            else {
                yield* this.handleText();
            }
        }
    }
    *handleEscapeSequence() {
        // Yield the ESC token
        yield {
            type: "ESC",
            value: "\x1B",
            position: this.pos++,
        };
        if (this.pos >= this.input.length)
            return;
        const nextChar = this.input[this.pos];
        if (nextChar === "[") {
            // CSI sequence
            yield {
                type: "CSI",
                value: "[",
                position: this.pos++,
            };
            yield* this.handleCSISequence();
        }
        else if (nextChar === "]") {
            // OSC sequence
            yield {
                type: "OSC",
                value: "]",
                position: this.pos++,
            };
            yield* this.handleOSCSequence();
        }
        else {
            // Simple escape sequence
            yield {
                type: "COMMAND",
                value: nextChar,
                position: this.pos++,
            };
        }
    }
    *handleCSISequence() {
        let paramBuffer = "";
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            // Handle question mark for private sequences
            if (char === "?" && paramBuffer.length === 0) {
                yield {
                    type: "QUESTION",
                    value: "?",
                    position: this.pos++,
                };
                continue;
            }
            // Parameter digits
            if (/[0-9]/.test(char)) {
                paramBuffer += char;
                this.pos++;
                continue;
            }
            // Parameter separator
            if (char === ";") {
                if (paramBuffer.length > 0) {
                    yield {
                        type: "PARAMETER",
                        value: paramBuffer,
                        position: this.pos - paramBuffer.length,
                    };
                    paramBuffer = "";
                }
                yield {
                    type: "PARAMETER_SEP",
                    value: ";",
                    position: this.pos++,
                };
                continue;
            }
            // Command character
            if (/[A-Za-z]/.test(char)) {
                if (paramBuffer.length > 0) {
                    yield {
                        type: "PARAMETER",
                        value: paramBuffer,
                        position: this.pos - paramBuffer.length,
                    };
                }
                yield {
                    type: "COMMAND",
                    value: char,
                    position: this.pos++,
                };
                break;
            }
            // Unknown character, treat as command
            yield {
                type: "COMMAND",
                value: char,
                position: this.pos++,
            };
            break;
        }
    }
    *handleOSCSequence() {
        let buffer = "";
        // Read until string terminator
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (char === "\x07") {
                // BEL terminator
                if (buffer.length > 0) {
                    yield {
                        type: "STRING",
                        value: buffer,
                        position: this.pos - buffer.length,
                    };
                }
                yield {
                    type: "ST",
                    value: "\x07",
                    position: this.pos++,
                };
                break;
            }
            if (char === "\x1B" && this.input[this.pos + 1] === "\\") {
                // ESC \ terminator
                if (buffer.length > 0) {
                    yield {
                        type: "STRING",
                        value: buffer,
                        position: this.pos - buffer.length,
                    };
                }
                yield {
                    type: "ESC",
                    value: "\x1B",
                    position: this.pos++,
                };
                yield {
                    type: "ST",
                    value: "\\",
                    position: this.pos++,
                };
                break;
            }
            buffer += char;
            this.pos++;
        }
    }
    *handleControlCharacter() {
        yield {
            type: "CONTROL",
            value: this.input[this.pos],
            position: this.pos++,
        };
    }
    *handleText() {
        let buffer = "";
        const startPos = this.pos;
        while (this.pos < this.input.length &&
            this.input[this.pos] >= " " &&
            this.input[this.pos] !== "\x1B") {
            buffer += this.input[this.pos++];
        }
        yield {
            type: "TEXT",
            value: buffer,
            position: startPos,
        };
    }
}
