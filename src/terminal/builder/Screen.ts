import { SequenceProducer } from "./SequenceBuilder.js";
import { CSISequence, CSICommand } from "../CSISequence.js";
import { OSCCommand, OSCSequence } from "../OSCSequence.js";
import {
  SimpleEscapeSequence,
  SimpleEscapeCommand,
} from "../SimpleEscapeSequence.js";
import { WindowSize } from "./Window.js";

export interface ScrollRegion {
  top: number;
  bottom: number;
}

export interface ScreenMargins {
  left: number;
  right: number;
}

export class Screen {
  static setScreenSync(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [2026], true),
    };
  }

  static resetScreenSync(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [2026], true),
    };
  }

  static setLineWrap(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [7], true),
    };
  }

  static resetLineWrap(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [7], true),
    };
  }

  static setBracketedPaste(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [2004], true),
    };
  }

  static resetBracketedPaste(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [2004], true),
    };
  }

  // Cursor state operations
  static saveCursorState(): SequenceProducer {
    return {
      toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECSC),
    };
  }

  static setWindowTitle(title: string): SequenceProducer {
    return {
      toSequence: () =>
        OSCSequence.create(OSCCommand.SET_WINDOW_TITLE, [title]),
    };
  }

  static resizeWindow(size: WindowSize): SequenceProducer {
    return {
      toSequence: () =>
        CSISequence.create(CSICommand.XTWINOPS, [8, size.height, size.width]),
    };
  }

  static restoreCursorState(): SequenceProducer {
    return {
      toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECRC),
    };
  }

  static clearScreen(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.ED, [2]),
    };
  }

  static softReset(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.DECSTR, []),
    };
  }

  // Scrolling operations
  static scrollUp(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SU, [count]),
    };
  }

  static scrollDown(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SD, [count]),
    };
  }

  static disableAutoWrap(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [7], true),
    };
  }

  // Set screen size explicitly
  static setScreenSize(lines: number): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.DECSLPP, [lines]),
    };
  }

  // Reset all margins and regions
  static resetAllMargins(): SequenceProducer[] {
    return [
      // Reset top/bottom margins
      {
        toSequence: () => CSISequence.create(CSICommand.DECSTBM, []),
      },
      // Reset left/right margins
      {
        toSequence: () => CSISequence.create(CSICommand.DECSLRM, [1, 1]),
      },
    ];
  }

  // Scroll region management
  static setScrollRegion(region: ScrollRegion): SequenceProducer {
    return {
      toSequence: () =>
        CSISequence.create(CSICommand.DECSTBM, [region.top, region.bottom]),
    };
  }

  // Screen buffer operations
  static alternateBuffer(enable: boolean): SequenceProducer {
    return {
      toSequence: () =>
        CSISequence.create(
          enable ? CSICommand.SM : CSICommand.RM,
          [1049], // Modern parameter for alternate buffer
          true
        ),
    };
  }

  // Screen alignment
  static alignmentTest(): SequenceProducer {
    return {
      toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECALN),
    };
  }

  // Screen margins
  static setMargins(margins: ScreenMargins): SequenceProducer {
    return {
      toSequence: () =>
        CSISequence.create(CSICommand.DECSLRM, [margins.left, margins.right]),
    };
  }

  // Utility method for batch operations
  static batch(operations: {
    scroll?: { direction: "up" | "down"; count?: number };
    scrollRegion?: ScrollRegion;
    margins?: ScreenMargins;
    alternateBuffer?: boolean;
    alignmentTest?: boolean;
    lineWrap?: boolean;
    screenSync?: boolean;
    bracketedPaste?: boolean;
    saveCursor?: boolean;
    restoreCursor?: boolean;
    windowTitle?: string;
    windowSize?: WindowSize;
  }): SequenceProducer[] {
    const sequences: SequenceProducer[] = [];

    if (operations.scroll) {
      sequences.push(
        operations.scroll.direction === "up"
          ? Screen.scrollUp(operations.scroll.count)
          : Screen.scrollDown(operations.scroll.count)
      );
    }

    if (operations.scrollRegion) {
      sequences.push(Screen.setScrollRegion(operations.scrollRegion));
    }

    if (operations.margins) {
      sequences.push(Screen.setMargins(operations.margins));
    }

    if (operations.alternateBuffer !== undefined) {
      sequences.push(Screen.alternateBuffer(operations.alternateBuffer));
    }

    if (operations.alignmentTest) {
      sequences.push(Screen.alignmentTest());
    }

    if (operations.lineWrap !== undefined) {
      sequences.push(
        operations.lineWrap ? Screen.setLineWrap() : Screen.resetLineWrap()
      );
    }

    if (operations.screenSync !== undefined) {
      sequences.push(
        operations.screenSync
          ? Screen.setScreenSync()
          : Screen.resetScreenSync()
      );
    }

    if (operations.bracketedPaste !== undefined) {
      sequences.push(
        operations.bracketedPaste
          ? Screen.setBracketedPaste()
          : Screen.resetBracketedPaste()
      );
    }

    if (operations.saveCursor) {
      sequences.push(Screen.saveCursorState());
    }

    if (operations.restoreCursor) {
      sequences.push(Screen.restoreCursorState());
    }

    if (operations.windowTitle) {
      sequences.push(Screen.setWindowTitle(operations.windowTitle));
    }

    if (operations.windowSize) {
      sequences.push(Screen.resizeWindow(operations.windowSize));
    }

    return sequences;
  }
}
