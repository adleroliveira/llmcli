import { SequenceProducer } from './SequenceBuilder.js';
import { CSISequence, CSICommand } from '../CSISequence.js';
import { SequenceType, ControlCharacter } from '../Command.js';
import { ControlSequence } from '../ControlSequence.js';

export enum EraseMode {
  ToCursor = 0,    // Erase from start to cursor
  FromCursor = 1,  // Erase from cursor to end
  All = 2,         // Erase all
  SavedLines = 3   // Erase saved lines (only for display)
}

export class Erase {
  // Screen clearing
  static display(mode: EraseMode = EraseMode.All): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.ED, [mode])
    };
  }

  // Line clearing
  static line(mode: EraseMode = EraseMode.All): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.EL, [mode])
    };
  }

  // Character operations
  static characters(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.DCH, [count])
    };
  }

  static deleteLines(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.DL, [count])
    };
  }

  // Insert operations
  static insertCharacters(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.ICH, [count])
    };
  }

  static insertLines(count: number = 1): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.IL, [count])
    };
  }

  // Backspace operations
  static backspace(count: number = 1): SequenceProducer {
    return {
      toSequence: () => ControlSequence.backspace()
    };
  }

  // Utility method for batch operations
  static batch(operations: {
    display?: EraseMode;
    line?: EraseMode;
    deleteChars?: number;
    deleteLines?: number;
    insertChars?: number;
    insertLines?: number;
    backspace?: number;
  }): SequenceProducer[] {
    const sequences: SequenceProducer[] = [];

    if (operations.display !== undefined) {
      sequences.push(Erase.display(operations.display));
    }

    if (operations.line !== undefined) {
      sequences.push(Erase.line(operations.line));
    }

    if (operations.deleteChars) {
      sequences.push(Erase.characters(operations.deleteChars));
    }

    if (operations.deleteLines) {
      sequences.push(Erase.deleteLines(operations.deleteLines));
    }

    if (operations.insertChars) {
      sequences.push(Erase.insertCharacters(operations.insertChars));
    }

    if (operations.insertLines) {
      sequences.push(Erase.insertLines(operations.insertLines));
    }

    if (operations.backspace) {
      sequences.push(Erase.backspace(operations.backspace));
    }

    return sequences;
  }
}