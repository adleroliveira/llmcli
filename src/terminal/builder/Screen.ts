import { SequenceProducer } from './SequenceBuilder.js';
import { CSISequence, CSICommand } from '../CSISequence.js';
import { SimpleEscapeSequence, SimpleEscapeCommand } from '../SimpleEscapeSequence.js';

export interface ScrollRegion {
  top: number;
  bottom: number;
}

export interface ScreenMargins {
  left: number;
  right: number;
}

export class Screen {
  // Scrolling operations
  static scrollUp(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SU, [count])
    };
  }

  static scrollDown(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SD, [count])
    };
  }

  // Scroll region management
  static setScrollRegion(region: ScrollRegion): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.DECSTBM, [region.top, region.bottom])
    };
  }

  // Screen buffer operations
  static alternateBuffer(enable: boolean): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(
        enable ? CSICommand.SM : CSICommand.RM,
        [47],
        true
      )
    };
  }

  // Screen alignment
  static alignmentTest(): SequenceProducer {
    return {
      toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECALN)
    };
  }

  // Screen margins
  static setMargins(margins: ScreenMargins): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.DECSLRM, [margins.left, margins.right])
    };
  }

  // Utility method for batch operations
  static batch(operations: {
    scroll?: { direction: 'up' | 'down'; count?: number };
    scrollRegion?: ScrollRegion;
    margins?: ScreenMargins;
    alternateBuffer?: boolean;
    alignmentTest?: boolean;
  }): SequenceProducer[] {
    const sequences: SequenceProducer[] = [];

    if (operations.scroll) {
      if (operations.scroll.direction === 'up') {
        sequences.push(Screen.scrollUp(operations.scroll.count));
      } else {
        sequences.push(Screen.scrollDown(operations.scroll.count));
      }
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

    return sequences;
  }
}