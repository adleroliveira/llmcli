import { SequenceProducer } from './SequenceBuilder.js';
import { CSISequence, CSICommand } from '../CSISequence.js';
import { SimpleEscapeSequence, SimpleEscapeCommand } from '../SimpleEscapeSequence.js';
import { ModeState } from '../ModeStateManager.js';

export class Mode {
  // Application Cursor Mode (DECCKM)
  static setApplicationCursor(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [1], true)
    };
  }

  static resetApplicationCursor(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [1], true)
    };
  }

  // Application Keypad Mode (DECPAM/DECPNM)
  static setApplicationKeypad(): SequenceProducer {
    return {
      toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECPAM)
    };
  }

  static resetApplicationKeypad(): SequenceProducer {
    return {
      toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECPNM)
    };
  }

  // Line Wrap Mode (DECAWM)
  static setWrap(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [7], true)
    };
  }

  static resetWrap(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [7], true)
    };
  }

  // Insert Mode (IRM)
  static setInsert(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [4])
    };
  }

  static resetInsert(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [4])
    };
  }

  // Origin Mode (DECOM)
  static setOriginMode(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [6], true)
    };
  }

  static resetOriginMode(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [6], true)
    };
  }

  // Auto Wrap Mode (Same as Line Wrap Mode - DECAWM)
  static setAutoWrap = Mode.setWrap;
  static resetAutoWrap = Mode.resetWrap;

  // Bracketed Paste Mode
  static setBracketedPaste(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [2004], true)
    };
  }

  static resetBracketedPaste(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [2004], true)
    };
  }

  // Mouse Tracking Modes
  static setMouseTracking(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [1000], true)
    };
  }

  static resetMouseTracking(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [1000], true)
    };
  }

  // Utility method to set multiple modes at once based on ModeState
  static setModes(modes: Partial<ModeState>): SequenceProducer[] {
    const sequences: SequenceProducer[] = [];

    if (modes.applicationCursor !== undefined) {
      sequences.push(modes.applicationCursor ?
        Mode.setApplicationCursor() :
        Mode.resetApplicationCursor());
    }

    if (modes.applicationKeypad !== undefined) {
      sequences.push(modes.applicationKeypad ?
        Mode.setApplicationKeypad() :
        Mode.resetApplicationKeypad());
    }

    if (modes.wrap !== undefined) {
      sequences.push(modes.wrap ?
        Mode.setWrap() :
        Mode.resetWrap());
    }

    if (modes.insert !== undefined) {
      sequences.push(modes.insert ?
        Mode.setInsert() :
        Mode.resetInsert());
    }

    if (modes.originMode !== undefined) {
      sequences.push(modes.originMode ?
        Mode.setOriginMode() :
        Mode.resetOriginMode());
    }

    if (modes.autoWrap !== undefined) {
      sequences.push(modes.autoWrap ?
        Mode.setAutoWrap() :
        Mode.resetAutoWrap());
    }

    if (modes.bracketedPaste !== undefined) {
      sequences.push(modes.bracketedPaste ?
        Mode.setBracketedPaste() :
        Mode.resetBracketedPaste());
    }

    if (modes.mouseTracking !== undefined) {
      sequences.push(modes.mouseTracking ?
        Mode.setMouseTracking() :
        Mode.resetMouseTracking());
    }

    return sequences;
  }
}