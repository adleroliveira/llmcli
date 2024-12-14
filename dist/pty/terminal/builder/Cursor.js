import { CSISequence, CSICommand } from '../CSISequence.js';
import { SimpleEscapeSequence, SimpleEscapeCommand } from '../SimpleEscapeSequence.js';
export class Cursor {
    // Basic cursor movement
    static up(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CUU, [count])
        };
    }
    static down(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CUD, [count])
        };
    }
    static forward(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CUF, [count])
        };
    }
    static backward(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CUB, [count])
        };
    }
    // Absolute positioning
    static moveTo(position) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CUP, [position.row, position.column])
        };
    }
    static moveToColumn(column) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CHA, [column])
        };
    }
    static moveToRow(row) {
        return {
            toSequence: () => CSISequence.create(CSICommand.VPA, [row])
        };
    }
    // Line movement
    static nextLine(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CNL, [count])
        };
    }
    static previousLine(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CPL, [count])
        };
    }
    // Cursor visibility
    static show() {
        return {
            toSequence: () => CSISequence.create(CSICommand.SM, [25], true)
        };
    }
    static hide() {
        return {
            toSequence: () => CSISequence.create(CSICommand.RM, [25], true)
        };
    }
    // Save and restore cursor position
    static save() {
        return {
            toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECSC)
        };
    }
    static restore() {
        return {
            toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECRC)
        };
    }
    // Tab control
    static tab(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CHT, [count])
        };
    }
    static tabBackward(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.CBT, [count])
        };
    }
    // Request cursor position (returns a sequence that will trigger a response from the terminal)
    static requestPosition() {
        return {
            toSequence: () => CSISequence.create(CSICommand.DSR, [6])
        };
    }
    // Utility method to create multiple cursor operations
    static batch(operations) {
        const sequences = [];
        if (operations.position) {
            sequences.push(Cursor.moveTo(operations.position));
        }
        if (operations.visible !== undefined) {
            sequences.push(operations.visible ? Cursor.show() : Cursor.hide());
        }
        if (operations.save) {
            sequences.push(Cursor.save());
        }
        if (operations.movements) {
            for (const movement of operations.movements) {
                switch (movement.direction) {
                    case 'up':
                        sequences.push(Cursor.up(movement.count));
                        break;
                    case 'down':
                        sequences.push(Cursor.down(movement.count));
                        break;
                    case 'forward':
                        sequences.push(Cursor.forward(movement.count));
                        break;
                    case 'backward':
                        sequences.push(Cursor.backward(movement.count));
                        break;
                }
            }
        }
        if (operations.restore) {
            sequences.push(Cursor.restore());
        }
        return sequences;
    }
}
