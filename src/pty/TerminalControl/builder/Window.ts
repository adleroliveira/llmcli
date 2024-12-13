import { SequenceProducer } from './SequenceBuilder.js';
import { CSISequence, CSICommand } from '../CSISequence.js';
import { OSCSequence, OSCCommand } from '../OSCSequence.js';

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export class Window {
  // Window Title Operations
  static setWindowTitle(title: string): SequenceProducer {
    return {
      toSequence: () => OSCSequence.create(OSCCommand.SET_WINDOW_TITLE, [title])
    };
  }

  static setIconName(name: string): SequenceProducer {
    return {
      toSequence: () => OSCSequence.create(OSCCommand.SET_ICON_NAME, [name])
    };
  }

  static setIconNameAndWindowTitle(text: string): SequenceProducer {
    return {
      toSequence: () => OSCSequence.create(OSCCommand.SET_ICON_NAME_AND_WINDOW_TITLE, [text])
    };
  }

  // Window Manipulation Operations
  static deiconify(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.SM, [1], true)
    };
  }

  static iconify(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.RM, [1], true)
    };
  }

  static moveWindow(position: WindowPosition): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.CUP, [position.y, position.x])
    };
  }

  static resizeWindow(size: WindowSize): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [8, size.height, size.width])
    };
  }

  static maximizeWindow(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [9, 1])
    };
  }

  static unmaximizeWindow(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [9, 0])
    };
  }

  static fullScreen(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [10, 1])
    };
  }

  static exitFullScreen(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [10, 0])
    };
  }

  // Window State Reporting (these return sequences that will trigger responses from the terminal)
  static requestWindowState(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [11])
    };
  }

  static requestWindowPosition(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [13])
    };
  }

  static requestWindowSize(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [14])
    };
  }

  static requestScreenSize(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [15])
    };
  }

  static requestCellSize(): SequenceProducer {
    return {
      toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [16])
    };
  }

  // Working Directory
  static setCurrentDirectory(dir: string): SequenceProducer {
    return {
      toSequence: () => OSCSequence.create(OSCCommand.SET_CURRENT_DIR, [dir])
    };
  }

  // Hyperlink Support
  static setHyperlink(uri: string, params: string = ""): SequenceProducer {
    return {
      toSequence: () => OSCSequence.create(OSCCommand.SET_HYPERLINK, [params, uri])
    };
  }

  // Utility method to create multiple window operations
  static batch(operations: {
    title?: string;
    position?: WindowPosition;
    size?: WindowSize;
    maximize?: boolean;
    fullscreen?: boolean;
    iconify?: boolean;
    directory?: string;
  }): SequenceProducer[] {
    const sequences: SequenceProducer[] = [];

    if (operations.title) {
      sequences.push(Window.setWindowTitle(operations.title));
    }

    if (operations.position) {
      sequences.push(Window.moveWindow(operations.position));
    }

    if (operations.size) {
      sequences.push(Window.resizeWindow(operations.size));
    }

    if (operations.maximize) {
      sequences.push(Window.maximizeWindow());
    }

    if (operations.fullscreen) {
      sequences.push(Window.fullScreen());
    }

    if (operations.iconify) {
      sequences.push(Window.iconify());
    }

    if (operations.directory) {
      sequences.push(Window.setCurrentDirectory(operations.directory));
    }

    return sequences;
  }
}