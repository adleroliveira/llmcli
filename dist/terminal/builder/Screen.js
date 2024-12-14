import { CSISequence, CSICommand } from '../CSISequence.js';
import { SimpleEscapeSequence, SimpleEscapeCommand } from '../SimpleEscapeSequence.js';
export class Screen {
    // Scrolling operations
    static scrollUp(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.SU, [count])
        };
    }
    static scrollDown(count = 1) {
        return {
            toSequence: () => CSISequence.create(CSICommand.SD, [count])
        };
    }
    // Scroll region management
    static setScrollRegion(region) {
        return {
            toSequence: () => CSISequence.create(CSICommand.DECSTBM, [region.top, region.bottom])
        };
    }
    // Screen buffer operations
    static alternateBuffer(enable) {
        return {
            toSequence: () => CSISequence.create(enable ? CSICommand.SM : CSICommand.RM, [47], true)
        };
    }
    // Screen alignment
    static alignmentTest() {
        return {
            toSequence: () => SimpleEscapeSequence.create(SimpleEscapeCommand.DECALN)
        };
    }
    // Screen margins
    static setMargins(margins) {
        return {
            toSequence: () => CSISequence.create(CSICommand.DECSLRM, [margins.left, margins.right])
        };
    }
    // Utility method for batch operations
    static batch(operations) {
        const sequences = [];
        if (operations.scroll) {
            if (operations.scroll.direction === 'up') {
                sequences.push(Screen.scrollUp(operations.scroll.count));
            }
            else {
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
