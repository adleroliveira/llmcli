import { VT100Sequence } from "./Command.js";
import { CharsetSequence, CharsetDesignator } from "./CharsetSequence.js";
import { SimpleEscapeSequence } from "./SimpleEscapeSequence.js";

export interface CharsetState {
  current: number; // Currently active charset (0 for G0, 1 for G1)
  g0: number; // G0 charset identifier
  g1: number; // G1 charset identifier
}

export class CharsetStateManager {
  // Default to ASCII ('B') for G0 and Special Graphics ('0') for G1
  private state: CharsetState = {
    current: 0, // Default to G0
    g0: 0x42, // 'B' - US ASCII
    g1: 0x30, // '0' - Special graphics
  };

  // Get current charset state
  public getState(): CharsetState {
    return { ...this.state };
  }

  public processSequence(sequence: VT100Sequence): void {
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
    } else if (sequence instanceof SimpleEscapeSequence) {
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
  public getCurrentCharset(): number {
    return this.state.current === 0 ? this.state.g0 : this.state.g1;
  }

  public reset(): void {
    this.state = {
      current: 0,
      g0: 0x42, // 'B' - US ASCII
      g1: 0x30, // '0' - Special graphics
    };
  }

  // Utility methods for charset operations
  public isSpecialGraphics(): boolean {
    const currentCharset = this.getCurrentCharset();
    return currentCharset === 0x30; // '0'
  }

  public isAscii(): boolean {
    const currentCharset = this.getCurrentCharset();
    return currentCharset === 0x42; // 'B'
  }

  public isGraphicsSet(): boolean {
    const charset = this.getCurrentCharset();
    return charset === 0x30 || charset === 0x32; // '0' or '2'
  }
}
