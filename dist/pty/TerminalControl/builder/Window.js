import { CSISequence, CSICommand } from '../CSISequence.js';
import { OSCSequence, OSCCommand } from '../OSCSequence.js';
export class Window {
    // Window Title Operations
    static setWindowTitle(title) {
        return {
            toSequence: () => OSCSequence.create(OSCCommand.SET_WINDOW_TITLE, [title])
        };
    }
    static setIconName(name) {
        return {
            toSequence: () => OSCSequence.create(OSCCommand.SET_ICON_NAME, [name])
        };
    }
    static setIconNameAndWindowTitle(text) {
        return {
            toSequence: () => OSCSequence.create(OSCCommand.SET_ICON_NAME_AND_WINDOW_TITLE, [text])
        };
    }
    // Window Manipulation Operations
    static deiconify() {
        return {
            toSequence: () => CSISequence.create(CSICommand.SM, [1], true)
        };
    }
    static iconify() {
        return {
            toSequence: () => CSISequence.create(CSICommand.RM, [1], true)
        };
    }
    static moveWindow(position) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CUP, [position.y, position.x])
        };
    }
    static resizeWindow(size) {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [8, size.height, size.width])
        };
    }
    static maximizeWindow() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [9, 1])
        };
    }
    static unmaximizeWindow() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [9, 0])
        };
    }
    static fullScreen() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [10, 1])
        };
    }
    static exitFullScreen() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [10, 0])
        };
    }
    // Window State Reporting (these return sequences that will trigger responses from the terminal)
    static requestWindowState() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [11])
        };
    }
    static requestWindowPosition() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [13])
        };
    }
    static requestWindowSize() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [14])
        };
    }
    static requestScreenSize() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [15])
        };
    }
    static requestCellSize() {
        return {
            toSequence: () => CSISequence.create(CSICommand.XTWINOPS, [16])
        };
    }
    // Working Directory
    static setCurrentDirectory(dir) {
        return {
            toSequence: () => OSCSequence.create(OSCCommand.SET_CURRENT_DIR, [dir])
        };
    }
    // Hyperlink Support
    static setHyperlink(uri, params = "") {
        return {
            toSequence: () => OSCSequence.create(OSCCommand.SET_HYPERLINK, [params, uri])
        };
    }
    // Utility method to create multiple window operations
    static batch(operations) {
        const sequences = [];
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
