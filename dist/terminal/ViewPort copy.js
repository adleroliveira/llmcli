import { VT100Parser } from "./VT100Parser.js";
import { SequenceType, ControlCharacter } from "./Command.js";
import { CSISequence, CSICommand } from "./CSISequence.js";
export class ViewPort {
    constructor(config) {
        this.savedCursorPosition = null;
        this.isCursorVisible = false;
        this.width = config.dimensions.width;
        this.height = config.dimensions.height;
        this.x = config.position.x;
        this.y = config.position.y;
        this.maxBufferLines = config.maxBufferLines || 1000;
        this.rawContent = [];
        this.buffer = this.initializeBuffer();
        this.cursor = { x: 0, y: 0 };
        this.firstVisibleLine = 0;
        this.parser = new VT100Parser();
    }
    initializeBuffer() {
        return Array(this.height)
            .fill(null)
            .map(() => Array(this.width).fill(" "));
    }
    wrapLine(line) {
        const wrappedLines = [];
        let currentLine = [];
        let currentColumn = 0;
        for (const char of line) {
            if (char === "\n") {
                // Fill remaining space with spaces
                while (currentColumn < this.width) {
                    currentLine.push(" ");
                    currentColumn++;
                }
                wrappedLines.push(currentLine);
                currentLine = [];
                currentColumn = 0;
                continue;
            }
            if (currentColumn >= this.width) {
                wrappedLines.push(currentLine);
                currentLine = [];
                currentColumn = 0;
            }
            currentLine.push(char);
            currentColumn++;
        }
        // Handle any remaining content
        if (currentColumn > 0) {
            while (currentColumn < this.width) {
                currentLine.push(" ");
                currentColumn++;
            }
            wrappedLines.push(currentLine);
        }
        return wrappedLines;
    }
    rewrapContent() {
        // Clear the buffer
        this.buffer = [];
        // Rewrap all content
        for (const line of this.rawContent) {
            const wrappedLines = this.wrapLine(line);
            for (const wrappedLine of wrappedLines) {
                if (this.buffer.length >= this.maxBufferLines) {
                    this.buffer.shift();
                }
                this.buffer.push(wrappedLine);
            }
        }
        // Ensure minimum buffer size
        while (this.buffer.length < this.height) {
            this.buffer.push(Array(this.width).fill(" "));
        }
        // Adjust cursor and scroll position
        const maxFirstLine = Math.max(0, this.buffer.length - this.height);
        this.firstVisibleLine = Math.min(this.firstVisibleLine, maxFirstLine);
        this.cursor.x = Math.min(this.cursor.x, this.width - 1);
    }
    getBufferSize() {
        return this.buffer.length;
    }
    addNewLine() {
        if (this.buffer.length >= this.maxBufferLines) {
            // Remove first line if we've reached the maximum
            this.buffer.shift();
        }
        // Add new line at the end
        this.buffer.push(Array(this.width).fill(" "));
    }
    ensureBufferSpace() {
        // If cursor.y is beyond current buffer size, add new lines
        while (this.cursor.y >= this.buffer.length) {
            this.addNewLine();
        }
    }
    getDimensions() {
        return { width: this.width, height: this.height };
    }
    getPosition() {
        return { x: this.x, y: this.y };
    }
    setPosition(position) {
        this.x = position.x;
        this.y = position.y;
    }
    resize(dimensions) {
        this.width = dimensions.width;
        this.height = dimensions.height;
        // Rewrap all content for new width
        this.rewrapContent();
    }
    getCursor() {
        return { ...this.cursor };
    }
    setCursor(position) {
        if (position.x < 0 ||
            position.x >= this.width ||
            position.y < 0 ||
            position.y >= this.height) {
            return false;
        }
        this.cursor = { ...position };
        return true;
    }
    write(text) {
        const sequences = this.parser.parseString(text);
        for (const sequence of sequences) {
            this.processSequence(sequence);
        }
    }
    processSequence(sequence) {
        if (sequence instanceof CSISequence) {
            if (CSISequence.isCursorCommand(sequence)) {
                this.processCursorCommand(sequence);
            }
            else if (CSISequence.isCursorVisibilityCommand(sequence)) {
                this.isCursorVisible = sequence.command == CSICommand.SM;
            }
            else {
                switch (sequence.command) {
                    case CSICommand.ED: {
                        // 'J' (Erase in Display)
                        const n = sequence.parameters[0]?.value ?? 0;
                        switch (n) {
                            case 0: // Clear from cursor to end of screen
                                // Clear current line from cursor
                                for (let x = this.cursor.x; x < this.width; x++) {
                                    this.buffer[this.cursor.y][x] = " ";
                                }
                                // Clear all lines below cursor
                                for (let y = this.cursor.y + 1; y < this.buffer.length; y++) {
                                    this.buffer[y] = Array(this.width).fill(" ");
                                }
                                break;
                            case 1: // Clear from start to cursor
                                // Clear lines above cursor
                                for (let y = 0; y < this.cursor.y; y++) {
                                    this.buffer[y] = Array(this.width).fill(" ");
                                }
                                // Clear current line up to cursor
                                for (let x = 0; x <= this.cursor.x; x++) {
                                    this.buffer[this.cursor.y][x] = " ";
                                }
                                break;
                            case 2: // Clear entire screen
                                this.buffer = this.initializeBuffer();
                                break;
                        }
                        break;
                    }
                    case CSICommand.EL: {
                        // 'K' - EL (Erase in Line)
                        const n = sequence.parameters[0]?.value ?? 0;
                        switch (n) {
                            case 0: // Clear from cursor to end of line
                                for (let x = this.cursor.x; x < this.width; x++) {
                                    this.buffer[this.cursor.y][x] = " ";
                                }
                                break;
                            case 1: // Clear from start of line to cursor
                                for (let x = 0; x <= this.cursor.x; x++) {
                                    this.buffer[this.cursor.y][x] = " ";
                                }
                                break;
                            case 2: // Clear entire line
                                this.buffer[this.cursor.y] = Array(this.width).fill(" ");
                                break;
                        }
                        break;
                    }
                }
            }
        }
        else {
            switch (sequence.type) {
                case SequenceType.C0:
                    this.processC0Control(sequence.controlChar);
                    break;
                case SequenceType.TEXT:
                    this.processText(sequence.toString());
                    break;
            }
        }
    }
    processC0Control(controlChar) {
        switch (controlChar) {
            case ControlCharacter.BEL: // Bell
                // Typically would make a sound - no action needed for visual display
                break;
            case ControlCharacter.BS: // Backspace
                if (this.cursor.x > 0) {
                    this.cursor.x--;
                }
                break;
            case ControlCharacter.HT: // Horizontal Tab
                // Move to next tab stop (typically 8 spaces)
                this.cursor.x = Math.min(this.width - 1, (Math.floor(this.cursor.x / 8) + 1) * 8);
                break;
            case ControlCharacter.LF: // Line Feed
                this.cursor.y++;
                this.ensureBufferSpace();
                break;
            case ControlCharacter.VT: // Vertical Tab
                this.cursor.y = Math.min(this.cursor.y + 1, this.buffer.length - 1);
                break;
            case ControlCharacter.FF: // Form Feed
                this.cursor.y = Math.min(this.cursor.y + 1, this.buffer.length - 1);
                break;
            case ControlCharacter.CR: // Carriage Return
                this.cursor.x = 0;
                break;
        }
    }
    processText(text) {
        for (const char of text) {
            const charCode = char.charCodeAt(0);
            // Handle control characters that might appear in text
            if (charCode <= 0x1f || charCode === 0x7f) {
                switch (charCode) {
                    case ControlCharacter.BS: // Backspace
                        if (this.cursor.x > 0) {
                            this.cursor.x--;
                            // Clear the current character
                            this.buffer[this.cursor.y][this.cursor.x] = " ";
                        }
                        continue;
                    case ControlCharacter.CR: // Carriage Return
                        this.cursor.x = 0;
                        continue;
                    case ControlCharacter.LF: // Line Feed
                        this.cursor.y++;
                        this.ensureBufferSpace();
                        continue;
                    case ControlCharacter.HT: // Horizontal Tab
                        const nextTabStop = Math.min(this.width - 1, (Math.floor(this.cursor.x / 8) + 1) * 8);
                        // Fill with spaces up to the next tab stop
                        while (this.cursor.x < nextTabStop) {
                            this.buffer[this.cursor.y][this.cursor.x] = " ";
                            this.cursor.x++;
                        }
                        continue;
                    default:
                        continue; // Skip other control characters
                }
            }
            // Handle printable characters
            if (this.cursor.y < this.buffer.length) {
                // Ensure the character isn't a zero-width space or other invisible character
                if (char !== "\u200B" && char.trim() !== "") {
                    this.buffer[this.cursor.y][this.cursor.x] = char;
                }
                else if (char === " ") {
                    // Explicitly handle space character
                    this.buffer[this.cursor.y][this.cursor.x] = " ";
                }
                // Move cursor forward
                this.cursor.x++;
                // Handle line wrapping
                if (this.cursor.x >= this.width) {
                    this.cursor.x = 0;
                    this.cursor.y++;
                    this.ensureBufferSpace();
                }
            }
        }
        // Ensure cursor is within valid bounds after processing
        this.cursor.x = Math.min(this.cursor.x, this.width - 1);
        this.cursor.y = Math.min(this.cursor.y, this.buffer.length - 1);
    }
    processCursorCommand(sequence) {
        const params = sequence.parameters;
        const defaultN = 1; // Default movement amount if no parameter provided
        switch (sequence.command) {
            case CSICommand.CUU: {
                // Cursor Up
                const n = params[0]?.value ?? defaultN;
                this.cursor.y = Math.max(0, this.cursor.y - n);
                break;
            }
            case CSICommand.CUD: {
                // Cursor Down
                const n = params[0]?.value ?? defaultN;
                this.cursor.y = Math.min(this.height - 1, this.cursor.y + n);
                break;
            }
            case CSICommand.CUF: {
                // Cursor Forward
                const n = params[0]?.value ?? defaultN;
                this.cursor.x = Math.min(this.width - 1, this.cursor.x + n);
                break;
            }
            case CSICommand.CUB: {
                // Cursor Back
                const n = params[0]?.value ?? defaultN;
                this.cursor.x = Math.max(0, this.cursor.x - n);
                break;
            }
            case CSICommand.CNL: {
                // Cursor Next Line
                const n = params[0]?.value ?? defaultN;
                this.cursor.y = Math.min(this.height - 1, this.cursor.y + n);
                this.cursor.x = 0; // Move to beginning of line
                break;
            }
            case CSICommand.CPL: {
                // Cursor Previous Line
                const n = params[0]?.value ?? defaultN;
                this.cursor.y = Math.max(0, this.cursor.y - n);
                this.cursor.x = 0; // Move to beginning of line
                break;
            }
            case CSICommand.CHA: {
                // Cursor Horizontal Absolute
                const n = (params[0]?.value ?? 1) - 1; // Convert 1-based to 0-based
                this.cursor.x = Math.max(0, Math.min(this.width - 1, n));
                break;
            }
            case CSICommand.CUP: {
                // Cursor Position
                // Convert 1-based indices to 0-based
                const row = (params[0]?.value ?? 1) - 1;
                const col = (params[1]?.value ?? 1) - 1;
                this.cursor.y = Math.max(0, Math.min(this.height - 1, row));
                this.cursor.x = Math.max(0, Math.min(this.width - 1, col));
                break;
            }
            case CSICommand.SCOSC: {
                // Save Cursor Position
                this.savedCursorPosition = { ...this.cursor };
                break;
            }
            case CSICommand.SCORC: {
                // Restore Cursor Position
                if (this.savedCursorPosition) {
                    this.cursor = { ...this.savedCursorPosition };
                    // Ensure restored position is within current bounds
                    this.cursor.x = Math.min(this.cursor.x, this.width - 1);
                    this.cursor.y = Math.min(this.cursor.y, this.height - 1);
                }
                break;
            }
        }
        // Ensure buffer has enough space for current cursor position
        this.ensureBufferSpace();
    }
    writeAt(x, y, char) {
        if (x < 0 || x >= this.width || y < 0) {
            return false;
        }
        // Ensure we have enough buffer lines
        while (y >= this.buffer.length) {
            this.addNewLine();
        }
        this.buffer[y][x] = char;
        return true;
    }
    getVisibleContent() {
        return this.buffer
            .slice(this.firstVisibleLine, this.firstVisibleLine + this.height)
            .map((line) => [...line]);
    }
    getBufferContent() {
        return this.buffer.map((line) => [...line]);
    }
    getRawContent() {
        return [...this.rawContent];
    }
    scrollUp(lines = 1) {
        this.firstVisibleLine = Math.max(0, this.firstVisibleLine - lines);
    }
    scrollDown(lines = 1) {
        const maxFirstLine = Math.max(0, this.buffer.length - this.height);
        this.firstVisibleLine = Math.min(maxFirstLine, this.firstVisibleLine + lines);
    }
    scrollToBottom() {
        this.firstVisibleLine = Math.max(0, this.buffer.length - this.height);
    }
    scrollToTop() {
        this.firstVisibleLine = 0;
    }
    getScrollPosition() {
        return this.firstVisibleLine;
    }
    setMaxBufferLines(maxLines) {
        this.maxBufferLines = maxLines;
        // Trim buffer if it exceeds new max
        if (this.buffer.length > maxLines) {
            const excess = this.buffer.length - maxLines;
            this.buffer = this.buffer.slice(excess);
            // Adjust cursor and scroll position if needed
            this.cursor.y = Math.min(this.cursor.y, maxLines - 1);
            this.firstVisibleLine = Math.min(this.firstVisibleLine, maxLines - this.height);
        }
    }
    clear() {
        this.buffer = this.initializeBuffer();
        this.cursor = { x: 0, y: 0 };
        this.firstVisibleLine = 0;
    }
}
