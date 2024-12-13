import { CSISequence, CSICommand } from '../CSISequence.js';
import { ControlSequence } from '../ControlSequence.js';
export var EraseMode;
(function (EraseMode) {
    EraseMode[EraseMode["ToCursor"] = 0] = "ToCursor";
    EraseMode[EraseMode["FromCursor"] = 1] = "FromCursor";
    EraseMode[EraseMode["All"] = 2] = "All";
    EraseMode[EraseMode["SavedLines"] = 3] = "SavedLines"; // Erase saved lines (only for display)
})(EraseMode || (EraseMode = {}));
export class Erase {
    // Screen clearing
    static display(mode = EraseMode.All) {
        return {
            toSequence: () => CSISequence.create(CSICommand.ED, [mode])
        };
    }
    // Line clearing
    static line(mode = EraseMode.All) {
        return {
            toSequence: () => CSISequence.create(CSICommand.EL, [mode])
        };
    }
    // Character operations
    static characters(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.DCH, [count])
        };
    }
    static deleteLines(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.DL, [count])
        };
    }
    // Insert operations
    static insertCharacters(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.ICH, [count])
        };
    }
    static insertLines(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.IL, [count])
        };
    }
    // Backspace operations
    static backspace(count = 1) {
        return {
            toSequence: () => ControlSequence.backspace()
        };
    }
    // Utility method for batch operations
    static batch(operations) {
        const sequences = [];
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
