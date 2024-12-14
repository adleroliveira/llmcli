import { ControlCharacter } from "./Command.js";
import { C1ControlSequence, C1Control, C1Mode } from "./C1ControlSequence.js";
import { SimpleEscapeSequence } from "./SimpleEscapeSequence.js";
import { CSISequence } from "./CSISequence.js";
import { OSCSequence } from "./OSCSequence.js";
import { DCSSequence } from "./DCSSequence.js";
import { TextSequence } from "./TextSequence.js";
import { CharsetSequence } from "./CharsetSequence.js";
// Parser states
var ParserState;
(function (ParserState) {
    ParserState["GROUND"] = "GROUND";
    ParserState["ESCAPE"] = "ESCAPE";
    ParserState["CSI"] = "CSI";
    ParserState["OSC"] = "OSC";
    ParserState["DCS"] = "DCS";
    ParserState["CHARSET"] = "CHARSET";
    ParserState["C1"] = "C1";
})(ParserState || (ParserState = {}));
export class VT100Parser {
    constructor(options = {
        support8BitC1: false,
        maxStringLength: 2048,
        strictMode: false,
    }) {
        this.options = options;
        this.state = ParserState.GROUND;
        this.buffer = [];
        this.params = [];
        this.intermediates = [];
        this.sequences = [];
        this.stringContent = "";
        this.textBuffer = [];
        this.incompleteBuffer = [];
        this.surrogatePending = null;
        this.savedState = null;
    }
    // Main parse method
    parse(data) {
        // If we have a saved state from an incomplete sequence, restore it
        if (this.savedState) {
            this.state = this.savedState.state;
            this.params = this.savedState.params;
            this.intermediates = this.savedState.intermediates;
            this.stringContent = this.savedState.stringContent;
            this.savedState = null;
        }
        // Combine any incomplete data with the new chunk
        const combinedData = new Uint8Array([...this.incompleteBuffer, ...data]);
        this.incompleteBuffer = []; // Clear the incomplete buffer
        return this._parseGenerator(combinedData);
    }
    *_parseGenerator(data) {
        for (let i = 0; i < data.length; i++) {
            const byte = data[i];
            try {
                const sequence = this.processByte(byte);
                if (sequence) {
                    yield sequence;
                }
            }
            catch (error) {
                if (this.options.strictMode) {
                    throw error;
                }
                this.reset();
            }
        }
        // Always flush the text buffer at the end of a chunk if it contains data
        const finalText = this.flushTextBuffer();
        if (finalText) {
            yield finalText;
        }
    }
    hasIncompleteBuffer() {
        return this.incompleteBuffer.length > 0;
    }
    /**
     * Parse a string input directly
     * This is useful when receiving data from terminal output as string
     */
    parseString(input) {
        return this.parse(this.stringToBytes(input));
    }
    /**
     * Convert a string to bytes while properly handling special characters
     * This method handles both regular characters and actual escape sequences in strings
     */
    stringToBytes(input) {
        if (Buffer.isBuffer(input)) {
            return new Uint8Array(input);
        }
        const bytes = [];
        let i = 0;
        while (i < input.length) {
            const char = input[i];
            const cp = char.codePointAt(0);
            if (!cp) {
                i++;
                continue;
            }
            // Handle special characters
            if (char === "\x1b") {
                bytes.push(ControlCharacter.ESC);
                i++;
                continue;
            }
            // Handle other control characters
            if (["\n", "\r", "\t", "\b", "\f", "\v", "\0"].includes(char)) {
                const controlBytes = {
                    "\n": 0x0a,
                    "\r": 0x0d,
                    "\t": 0x09,
                    "\b": 0x08,
                    "\f": 0x0c,
                    "\v": 0x0b,
                    "\0": 0x00,
                };
                bytes.push(controlBytes[char]);
                i++;
                continue;
            }
            // Check for surrogate pair
            if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < input.length) {
                // This is a high surrogate, look ahead for low surrogate
                const nextChar = input[i + 1];
                const nextCp = nextChar.codePointAt(0);
                if (nextCp && nextCp >= 0xdc00 && nextCp <= 0xdfff) {
                    // We have a valid surrogate pair
                    const pair = input.slice(i, i + 2);
                    const fullCodePoint = pair.codePointAt(0);
                    if (fullCodePoint) {
                        const encoder = new TextEncoder();
                        const encoded = encoder.encode(pair);
                        bytes.push(...encoded);
                        i += 2;
                        continue;
                    }
                }
            }
            // Regular character or invalid surrogate
            const encoder = new TextEncoder();
            const encoded = encoder.encode(char);
            bytes.push(...encoded);
            i++;
        }
        const result = new Uint8Array(bytes);
        return result;
    }
    /**
     * Helper method to test if a string contains escape sequences
     */
    static hasEscapeSequences(input) {
        return (input.includes("\x1b") ||
            input
                .split("")
                .some((char) => char.charCodeAt(0) >= 0x80 && char.charCodeAt(0) <= 0x9f));
    }
    flushTextBuffer() {
        if (this.textBuffer.length === 0) {
            return null;
        }
        // If we have a pending surrogate, don't flush yet
        if (this.surrogatePending !== null) {
            this.incompleteBuffer = [...this.textBuffer];
            this.textBuffer = [];
            return null;
        }
        // If we have a pending UTF-8 sequence, don't flush yet
        if (this.savedState?.expectedBytes &&
            this.textBuffer.length < this.savedState.expectedBytes) {
            this.incompleteBuffer = [...this.textBuffer];
            this.textBuffer = [];
            return null;
        }
        const bytes = new Uint8Array(this.textBuffer);
        let text;
        try {
            // First try strict UTF-8 decoding
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        catch (e) {
            // If decoding fails, check if we might be in the middle of a sequence
            const lastByte = bytes[bytes.length - 1];
            if ((lastByte & 0x80) !== 0) {
                // High bit set
                // Determine if this could be the start of a new sequence
                if ((lastByte & 0xf8) === 0xf0) {
                    // 4-byte sequence
                    this.incompleteBuffer = [lastByte];
                    bytes.slice(0, -1);
                }
                else if ((lastByte & 0xf0) === 0xe0) {
                    // 3-byte sequence
                    this.incompleteBuffer = [lastByte];
                    bytes.slice(0, -1);
                }
                else if ((lastByte & 0xe0) === 0xc0) {
                    // 2-byte sequence
                    this.incompleteBuffer = [lastByte];
                    bytes.slice(0, -1);
                }
            }
            // Try decoding again with what we have
            try {
                text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
            }
            catch (e) {
                // If it still fails, use replacement character mode
                text = new TextDecoder("utf-8").decode(bytes);
            }
        }
        this.textBuffer = [];
        return new TextSequence(bytes, text);
    }
    processByte(byte) {
        switch (this.state) {
            case ParserState.GROUND:
                return this.processGround(byte);
            case ParserState.ESCAPE:
                return this.processEscape(byte);
            case ParserState.CSI:
                return this.processCSI(byte);
            case ParserState.OSC:
                return this.processOSC(byte);
            case ParserState.DCS:
                return this.processDCS(byte);
            case ParserState.CHARSET:
                return this.processCharset(byte);
            default:
                throw new Error(`Invalid parser state: ${this.state}`);
        }
    }
    processGround(byte) {
        // If we see an ESC character, flush text and start escape sequence
        if (byte === ControlCharacter.ESC) {
            const textSequence = this.flushTextBuffer();
            this.state = ParserState.ESCAPE;
            this.buffer = [byte];
            return textSequence;
        }
        // Handle potential CSI sequence start
        if (byte === 0x5b &&
            this.buffer.length === 1 &&
            this.buffer[0] === ControlCharacter.ESC) {
            this.state = ParserState.CSI;
            this.buffer.push(byte);
            return null;
        }
        // Handle potential UTF-16 surrogate pairs
        if (this.surrogatePending !== null) {
            // If we see a new potential high surrogate while waiting for a low surrogate,
            // flush the pending one first
            if (byte >= 0xd800 && byte <= 0xdbff) {
                this.textBuffer.push(this.surrogatePending);
                this.surrogatePending = byte;
                return null;
            }
            // Check for low surrogate
            if (byte >= 0xdc00 && byte <= 0xdfff) {
                // Valid surrogate pair - convert to UTF-8
                const highSurrogate = this.surrogatePending;
                const lowSurrogate = byte;
                const codePoint = ((highSurrogate - 0xd800) << 10) + (lowSurrogate - 0xdc00) + 0x10000;
                // Convert to UTF-8 bytes
                const utf8Bytes = [];
                utf8Bytes.push(0xf0 | ((codePoint >> 18) & 0x07));
                utf8Bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
                utf8Bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
                utf8Bytes.push(0x80 | (codePoint & 0x3f));
                this.textBuffer.push(...utf8Bytes);
                this.surrogatePending = null;
                return null;
            }
            // Neither a high nor low surrogate - flush pending and continue
            this.textBuffer.push(this.surrogatePending);
            this.surrogatePending = null;
            // Continue processing current byte
        }
        // Check for high surrogate
        if (byte >= 0xd800 && byte <= 0xdbff) {
            this.surrogatePending = byte;
            return null;
        }
        // Check if this byte starts a UTF-8 sequence by examining the high bits
        if ((byte & 0x80) !== 0) {
            let bytesToRead = 0;
            // Improved UTF-8 sequence length detection
            if ((byte & 0xf8) === 0xf0 && byte <= 0xf4) {
                // Valid 4-byte sequence start
                bytesToRead = 4;
            }
            else if ((byte & 0xf0) === 0xe0) {
                // 3-byte sequence
                bytesToRead = 3;
            }
            else if ((byte & 0xe0) === 0xc0 && byte >= 0xc2) {
                // Valid 2-byte sequence start
                bytesToRead = 2;
            }
            else if ((byte & 0xc0) === 0x80) {
                // Continuation byte
                if (this.textBuffer.length > 0 && this.savedState?.expectedBytes) {
                    this.textBuffer.push(byte);
                    if (this.textBuffer.length === this.savedState.expectedBytes) {
                        // Validate the sequence before accepting it
                        try {
                            new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(this.textBuffer));
                            this.savedState = null;
                        }
                        catch (e) {
                            // Invalid sequence - handle as regular bytes
                            this.savedState = null;
                        }
                    }
                    return null;
                }
            }
            if (bytesToRead > 0) {
                this.textBuffer.push(byte);
                this.savedState = {
                    state: this.state,
                    params: [...this.params],
                    intermediates: [...this.intermediates],
                    stringContent: this.stringContent,
                    expectedBytes: bytesToRead,
                };
                return null;
            }
        }
        // Regular ASCII character
        if (byte < 0x80) {
            this.textBuffer.push(byte);
            return null;
        }
        // Only process as C1 if explicitly configured, not part of UTF-8, and not already in a sequence
        if (this.options.support8BitC1 &&
            byte >= 0x80 &&
            byte <= 0x9f &&
            this.textBuffer.length === 0 &&
            !this.savedState?.expectedBytes) {
            return this.processC1Control(byte);
        }
        // Unknown byte - add to text buffer if not strict
        if (!this.options.strictMode) {
            this.textBuffer.push(byte);
        }
        return null;
    }
    processEscape(byte) {
        this.buffer.push(byte);
        // Handle standard escape sequences
        switch (byte) {
            case "[".charCodeAt(0): // CSI
                this.state = ParserState.CSI;
                return null;
            case "]".charCodeAt(0): // OSC
                this.state = ParserState.OSC;
                return null;
            case "P".charCodeAt(0): // DCS
                this.state = ParserState.DCS;
                return null;
            case "(".charCodeAt(0): // G0 charset
            case ")".charCodeAt(0): // G1 charset
            case "*".charCodeAt(0): // G2 charset
            case "+".charCodeAt(0): // G3 charset
                this.state = ParserState.CHARSET;
                return null;
            default:
                // Handle Fe sequences (Final byte in range 0x30-0x7E)
                if (byte >= 0x30 && byte <= 0x7e) {
                    const sequence = new SimpleEscapeSequence(new Uint8Array(this.buffer), byte);
                    // Reset the parser state completely - remove special handling for '='
                    this.reset();
                    return sequence;
                }
                // Handle intermediate bytes (range 0x20-0x2F)
                if (byte >= 0x20 && byte <= 0x2f) {
                    // Continue collecting bytes
                    return null;
                }
                // If we reach here and are in strict mode, it's an invalid sequence
                if (this.options.strictMode) {
                    throw new Error(`Invalid escape sequence byte: ${byte} (0x${byte.toString(16)})`);
                }
                // In non-strict mode, reset and ignore the sequence
                this.reset();
                return null;
        }
    }
    processCSI(byte) {
        this.buffer.push(byte);
        // If we get an ESC while processing CSI, it's the start of a new sequence
        if (byte === ControlCharacter.ESC) {
            // Complete the current sequence if possible
            if (this.buffer.length > 2) {
                const params = this.parseParams();
                const sequence = new CSISequence(new Uint8Array(this.buffer.slice(0, -1)), // exclude the ESC
                params, this.intermediates, this.buffer[this.buffer.length - 2] // use last byte before ESC as final
                );
                this.reset();
                this.state = ParserState.ESCAPE;
                this.buffer = [byte];
                return sequence;
            }
            // Otherwise start fresh
            this.reset();
            this.state = ParserState.ESCAPE;
            this.buffer = [byte];
            return null;
        }
        // Parameter bytes (including '?' for private parameters)
        if ((byte >= 0x30 && byte <= 0x3f) ||
            (this.params.length === 0 && byte === "?".charCodeAt(0))) {
            this.params.push(String.fromCharCode(byte));
            return null;
        }
        // Intermediate bytes
        if (byte >= 0x20 && byte <= 0x2f) {
            this.intermediates.push(byte);
            return null;
        }
        // Final byte
        if (byte >= 0x40 && byte <= 0x7e) {
            const params = this.parseParams();
            const sequence = new CSISequence(new Uint8Array(this.buffer), params, this.intermediates, byte);
            this.reset();
            return sequence;
        }
        if (this.options.strictMode) {
            throw new Error(`Invalid CSI sequence byte: ${byte}`);
        }
        this.reset();
        return null;
    }
    processOSC(byte) {
        this.buffer.push(byte);
        // Check for BEL terminator
        if (byte === ControlCharacter.BEL) {
            const sequence = new OSCSequence(new Uint8Array(this.buffer), this.stringContent, ControlCharacter.BEL);
            this.reset();
            return sequence;
        }
        // Check for ST terminator (ESC \)
        if (byte === 0x5c &&
            this.buffer.length > 1 &&
            this.buffer[this.buffer.length - 2] === ControlCharacter.ESC) {
            const sequence = new OSCSequence(new Uint8Array(this.buffer), this.stringContent, ControlCharacter.ST);
            this.reset();
            return sequence;
        }
        // Don't add ESC or the following \ to the string content
        if (!(byte === ControlCharacter.ESC ||
            (byte === 0x5c &&
                this.buffer.length > 1 &&
                this.buffer[this.buffer.length - 2] === ControlCharacter.ESC))) {
            if (this.stringContent.length < this.options.maxStringLength) {
                this.stringContent += String.fromCharCode(byte);
            }
            else if (this.options.strictMode) {
                throw new Error("OSC string too long");
            }
        }
        return null;
    }
    processDCS(byte) {
        this.buffer.push(byte);
        // String terminator
        if (byte === ControlCharacter.ST) {
            const params = this.parseParams();
            const sequence = new DCSSequence(new Uint8Array(this.buffer), params, this.intermediates, this.stringContent, ControlCharacter.ST);
            this.reset();
            return sequence;
        }
        // Parameter bytes
        if (this.params.length === 0 && byte >= 0x30 && byte <= 0x3f) {
            this.params.push(String.fromCharCode(byte));
            return null;
        }
        // Intermediate bytes
        if (this.intermediates.length === 0 && byte >= 0x20 && byte <= 0x2f) {
            this.intermediates.push(byte);
            return null;
        }
        // Add to string content
        if (this.stringContent.length < this.options.maxStringLength) {
            this.stringContent += String.fromCharCode(byte);
        }
        else if (this.options.strictMode) {
            throw new Error("DCS string too long");
        }
        return null;
    }
    processCharset(byte) {
        this.buffer.push(byte);
        const designator = String.fromCharCode(this.buffer[1]);
        const sequence = new CharsetSequence(new Uint8Array(this.buffer), designator, byte);
        this.reset();
        return sequence;
    }
    processC1Control(byte) {
        // Find the C1 control type from the byte
        const controlType = Object.entries(C1Control).find(([_, codes]) => codes[0] === byte)?.[0];
        if (!controlType) {
            if (this.options.strictMode) {
                throw new Error(`Invalid C1 control byte: ${byte}`);
            }
            return null;
        }
        return new C1ControlSequence(new Uint8Array([byte]), controlType, C1Mode.BIT_8);
    }
    parseParams() {
        if (this.params.length === 0) {
            return [];
        }
        const paramString = this.params.join("");
        // Handle private parameters (starting with ?)
        if (paramString.startsWith("?")) {
            // Split the rest by semicolons in case there are multiple private parameters
            return paramString
                .slice(1)
                .split(";")
                .map((param) => ({
                value: parseInt(param, 10),
                private: true,
            }));
        }
        // Handle regular parameters
        return paramString.split(";").map((param) => ({
            value: parseInt(param, 10),
            private: false,
        }));
    }
    reset() {
        this.state = ParserState.GROUND;
        this.buffer = [];
        this.params = [];
        this.intermediates = [];
        this.stringContent = "";
        this.surrogatePending = null;
    }
}
