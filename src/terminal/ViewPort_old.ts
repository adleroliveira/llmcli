import { VT100Parser } from "./VT100Parser.js";
import { VT100Sequence, SequenceType, ControlCharacter } from "./Command.js";
import { CSISequence, CSICommand } from "./CSISequence.js";

interface ViewPortDimensions {
  width: number;
  height: number;
}

interface ViewPortPosition {
  x: number;
  y: number;
}

interface ViewPortConfig {
  dimensions: ViewPortDimensions;
  position: ViewPortPosition;
  maxBufferLines?: number;
}

export class ViewPort {
  private width: number;
  private height: number;
  private x: number;
  private y: number;
  private buffer: string[][];
  private cursor: ViewPortPosition;
  private maxBufferLines: number;
  private firstVisibleLine: number;
  private rawContent: string[];
  private parser: VT100Parser;
  private savedCursorPosition: ViewPortPosition | null = null;
  private isCursorVisible: boolean = false;

  constructor(config: ViewPortConfig) {
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

  private initializeBuffer(): string[][] {
    return Array(this.height)
      .fill(null)
      .map(() => Array(this.width).fill(" "));
  }

  private wrapLine(line: string): string[][] {
    const wrappedLines: string[][] = [];
    let currentLine: string[] = [];
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

  private rewrapContent(): void {
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

  public getBufferSize(): number {
    return this.buffer.length;
  }

  private addNewLine(): void {
    if (this.buffer.length >= this.maxBufferLines) {
      // Remove first line if we've reached the maximum
      this.buffer.shift();
    }
    // Add new line at the end
    this.buffer.push(Array(this.width).fill(" "));
  }

  private ensureBufferSpace(): void {
    // If cursor.y is beyond current buffer size, add new lines
    while (this.cursor.y >= this.buffer.length) {
      this.addNewLine();
    }
  }

  public getDimensions(): ViewPortDimensions {
    return { width: this.width, height: this.height };
  }

  public getPosition(): ViewPortPosition {
    return { x: this.x, y: this.y };
  }

  public setPosition(position: ViewPortPosition): void {
    this.x = position.x;
    this.y = position.y;
  }

  public resize(dimensions: ViewPortDimensions): void {
    this.width = dimensions.width;
    this.height = dimensions.height;

    // Rewrap all content for new width
    this.rewrapContent();
  }

  public getCursor(): ViewPortPosition {
    return { ...this.cursor };
  }

  public setCursor(position: ViewPortPosition): boolean {
    if (
      position.x < 0 ||
      position.x >= this.width ||
      position.y < 0 ||
      position.y >= this.height
    ) {
      return false;
    }
    this.cursor = { ...position };
    return true;
  }

  public write(text: string): void {
    const sequences = this.parser.parseString(text);
    for (const sequence of sequences) {
      this.processSequence(sequence);
    }
  }

  private processSequence(sequence: VT100Sequence): void {
    if (sequence instanceof CSISequence) {
      if (CSISequence.isCursorCommand(sequence)) {
        this.processCursorCommand(sequence);
      } else if (CSISequence.isCursorVisibilityCommand(sequence)) {
        this.isCursorVisible = sequence.command == CSICommand.SM;
      } else {
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
    } else {
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

  private processC0Control(controlChar: ControlCharacter): void {
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
        this.cursor.x = Math.min(
          this.width - 1,
          (Math.floor(this.cursor.x / 8) + 1) * 8
        );
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

  private processText(text: string): void {
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
            const nextTabStop = Math.min(
              this.width - 1,
              (Math.floor(this.cursor.x / 8) + 1) * 8
            );
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
        } else if (char === " ") {
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

  private processCursorCommand(sequence: CSISequence) {
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

  public writeAt(x: number, y: number, char: string): boolean {
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

  public getVisibleContent(): string[][] {
    return this.buffer
      .slice(this.firstVisibleLine, this.firstVisibleLine + this.height)
      .map((line) => [...line]);
  }

  public getBufferContent(): string[][] {
    return this.buffer.map((line) => [...line]);
  }

  public getRawContent(): string[] {
    return [...this.rawContent];
  }

  public scrollUp(lines: number = 1): void {
    this.firstVisibleLine = Math.max(0, this.firstVisibleLine - lines);
  }

  public scrollDown(lines: number = 1): void {
    const maxFirstLine = Math.max(0, this.buffer.length - this.height);
    this.firstVisibleLine = Math.min(
      maxFirstLine,
      this.firstVisibleLine + lines
    );
  }

  public scrollToBottom(): void {
    this.firstVisibleLine = Math.max(0, this.buffer.length - this.height);
  }

  public scrollToTop(): void {
    this.firstVisibleLine = 0;
  }

  public getScrollPosition(): number {
    return this.firstVisibleLine;
  }

  public setMaxBufferLines(maxLines: number): void {
    this.maxBufferLines = maxLines;
    // Trim buffer if it exceeds new max
    if (this.buffer.length > maxLines) {
      const excess = this.buffer.length - maxLines;
      this.buffer = this.buffer.slice(excess);
      // Adjust cursor and scroll position if needed
      this.cursor.y = Math.min(this.cursor.y, maxLines - 1);
      this.firstVisibleLine = Math.min(
        this.firstVisibleLine,
        maxLines - this.height
      );
    }
  }

  public clear(): void {
    this.buffer = this.initializeBuffer();
    this.cursor = { x: 0, y: 0 };
    this.firstVisibleLine = 0;
  }
}
