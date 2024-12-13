import { CharsetSequence, CharsetDesignator } from "./CharsetSequence.js";
import { SimpleEscapeSequence } from "./SimpleEscapeSequence.js";
export class CharsetStateManager {
    constructor() {
        // Default to ASCII ('B') for G0 and Special Graphics ('0') for G1
        this.state = {
            current: 0, // Default to G0
            g0: 0x42, // 'B' - US ASCII
            g1: 0x30, // '0' - Special graphics
        };
    }
    // Get current charset state
    getState() {
        return { ...this.state };
    }
    processSequence(sequence) {
        if (sequence instanceof CharsetSequence) {
            // Handle charset designation
            switch (sequence.designator) {
                case CharsetDesignator.G0:
                    if (sequence.isValid()) {
                        this.state.g0 = sequence.charset;
                    }
                    break;
                case CharsetDesignator.G1:
                    if (sequence.isValid()) {
                        this.state.g1 = sequence.charset;
                    }
                    break;
            }
        }
        else if (sequence instanceof SimpleEscapeSequence) {
            // Handle shift sequences
            switch (sequence.finalByte) {
                case 0x0f: // SI (Shift In) - Switch to G0
                    this.state.current = 0;
                    break;
                case 0x0e: // SO (Shift Out) - Switch to G1
                    this.state.current = 1;
                    break;
            }
        }
    }
    // Get the currently active charset
    getCurrentCharset() {
        return this.state.current === 0 ? this.state.g0 : this.state.g1;
    }
    reset() {
        this.state = {
            current: 0,
            g0: 0x42, // 'B' - US ASCII
            g1: 0x30, // '0' - Special graphics
        };
    }
    // Utility methods for charset operations
    isSpecialGraphics() {
        const currentCharset = this.getCurrentCharset();
        return currentCharset === 0x30; // '0'
    }
    isAscii() {
        const currentCharset = this.getCurrentCharset();
        return currentCharset === 0x42; // 'B'
    }
    isGraphicsSet() {
        const charset = this.getCurrentCharset();
        return charset === 0x30 || charset === 0x32; // '0' or '2'
    }
}
