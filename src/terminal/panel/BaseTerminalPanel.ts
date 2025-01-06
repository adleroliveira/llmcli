import { EventEmitter } from "events";
import {
  TerminalPanel,
  Dimensions,
  CursorPosition,
  Cell,
  PanelBuffer,
} from "./interfaces.js";
import { VT100Parser } from "../VT100Parser.js";
import { ANSISequence } from "../Command.js";
import { BufferManager } from "./BufferManager.js";
import { CharacterSet } from "../CharsetSequence.js";
import { DebugLogger } from "../DebugLogger.js";
import { VT100Formatter } from "../VT100Formatter.js";

function createEmptyCell(dirty: boolean = true): Cell {
  return {
    char: "",
    attributes: {},
    isDirty: dirty,
  };
}

export class BaseTerminalPanel extends EventEmitter implements TerminalPanel {
  protected _id: string;
  protected _dimensions: Dimensions;
  protected _focused: boolean;
  protected _buffer: Cell[][];
  protected _cursor: CursorPosition;
  protected _savedCursor: CursorPosition | null;
  protected _tabWidth: number;
  protected _tabStops: Set<number>;
  protected _parser: VT100Parser = new VT100Parser({
    support8BitC1: true,
    maxStringLength: 2048,
    strictMode: true,
  });
  protected bufferManager = new BufferManager(this);
  protected _scrollRegion: { top: number; bottom: number } = {
    top: 0,
    bottom: 0,
  };
  private windowTitle: string;
  private iconName: string;
  private workingDir: string;
  private _hasChanges: boolean = false;
  private _updatePending: boolean = false;
  private _batchUpdates: boolean = false;

  constructor(id: string, dimensions: Dimensions, tabWidth: number = 8) {
    super();
    this._id = id;
    this._dimensions = dimensions;
    this._focused = false;
    this._tabWidth = tabWidth;
    this._cursor = { row: 0, col: 0 };
    this._savedCursor = null;
    this._buffer = this.createEmptyBuffer(dimensions);
    this._hasChanges = true;
    this._tabStops = new Set();
    this.initializeTabStops();
    this.windowTitle = "";
    this.iconName = "";
    this.workingDir = "";
  }

  protected readonly specialGraphicsMap: { [key: string]: string } = {
    "`": "◆", // Diamond
    a: "▒", // Checkerboard
    b: "␉", // HT
    c: "␌", // FF
    d: "␍", // CR
    e: "␊", // LF
    f: "°", // Degree
    g: "±", // Plus/minus
    h: "␤", // NL
    i: "␋", // VT
    j: "┘", // Lower right corner
    k: "┐", // Upper right corner
    l: "┌", // Upper left corner
    m: "└", // Lower left corner
    n: "┼", // Crossing lines
    o: "⎺", // Horizontal line - scan 1
    p: "⎻", // Horizontal line - scan 3
    q: "─", // Horizontal line - scan 5
    r: "⎼", // Horizontal line - scan 7
    s: "⎽", // Horizontal line - scan 9
    t: "├", // Left T
    u: "┤", // Right T
    v: "┴", // Bottom T
    w: "┬", // Top T
    x: "│", // Vertical line
    y: "≤", // Less than or equal to
    z: "≥", // Greater than or equal to
    "{": "π", // Pi
    "|": "≠", // Not equal to
    "}": "£", // UK pound symbol
    "~": "·", // Centered dot
  };

  protected mapCharacter(char: string, charsetType: CharacterSet): string {
    if (charsetType === CharacterSet.SpecialGraphics) {
      return this.specialGraphicsMap[char] || char;
    }
    return char;
  }

  protected createEmptyBuffer(
    dimensions: Dimensions,
    dirty: boolean = false
  ): Cell[][] {
    return Array(dimensions.rows)
      .fill(null)
      .map(() =>
        Array(dimensions.cols)
          .fill(null)
          .map(() => ({ ...createEmptyCell(dirty) }))
      );
  }

  beginBatchUpdate(): void {
    this._batchUpdates = true;
  }

  endBatchUpdate(): void {
    this._batchUpdates = false;
    if (this._updatePending) {
      this.emit("bufferUpdate");
      this._updatePending = false;
    }
  }

  protected initializeTabStops(): void {
    // Set default tab stops every 8 columns (or custom tabWidth)
    for (let i = 0; i < this._dimensions.cols; i += this._tabWidth) {
      this._tabStops.add(i);
    }
  }

  protected markCellDirty(row: number, col: number): void {
    if (
      row >= 0 &&
      row < this._dimensions.rows &&
      col >= 0 &&
      col < this._dimensions.cols
    ) {
      this._buffer[row][col].isDirty = true;
      this._hasChanges = true;
    }
  }

  setScrollRegion(top: number, bottom: number): void {
    // Ensure the values are within bounds
    this._scrollRegion = {
      top: Math.max(0, Math.min(top, this._dimensions.rows - 1)),
      bottom: Math.max(0, Math.min(bottom, this._dimensions.rows - 1)),
    };

    // Ensure top is less than or equal to bottom
    if (this._scrollRegion.top > this._scrollRegion.bottom) {
      [this._scrollRegion.top, this._scrollRegion.bottom] = [
        this._scrollRegion.bottom,
        this._scrollRegion.top,
      ];
    }
  }

  protected triggerBufferUpdate(): void {
    if (this._batchUpdates) {
      this._updatePending = true;
    } else {
      this.emit("bufferUpdate");
    }
  }

  protected triggerResize(): void {
    this.emit("resize", this._dimensions);
  }

  private handleSequence(sequence: ANSISequence) {
    this.bufferManager.handleSequence(sequence);
  }

  // Required interface getters
  get id(): string {
    return this._id;
  }
  get dimensions(): Dimensions {
    return this._dimensions;
  }
  get focused(): boolean {
    return this._focused;
  }
  get tabWidth(): number {
    return this._tabWidth;
  }

  getBuffer(): PanelBuffer {
    return {
      lines: this._buffer.map((line) => line.map((cell) => ({ ...cell }))),
      cursor: { ...this._cursor },
      dimensions: { ...this._dimensions },
    };
  }

  // Tab operations
  setTabWidth(width: number): void {
    this._tabWidth = width;
    this._tabStops.clear();
    this.initializeTabStops();
  }

  setTabStop(): void {
    this._tabStops.add(this._cursor.col);
  }

  clearTabStop(): void {
    this._tabStops.delete(this._cursor.col);
  }

  clearAllTabStops(): void {
    this._tabStops.clear();
  }

  handleTab(): void {
    // Find next tab stop after current position
    const nextStop = Array.from(this._tabStops)
      .sort((a, b) => a - b)
      .find((stop) => stop > this._cursor.col);

    if (nextStop !== undefined && nextStop < this._dimensions.cols) {
      this._cursor.col = nextStop;
    } else {
      // If no tab stop found, move to next tab width boundary or end of line
      const nextPos = Math.min(
        (Math.floor(this._cursor.col / this._tabWidth) + 1) * this._tabWidth,
        this._dimensions.cols - 1
      );
      this._cursor.col = nextPos;
    }
  }

  // Cursor operations
  setCursorPosition(position: CursorPosition): void {
    this._cursor = {
      row: Math.max(0, Math.min(position.row, this._dimensions.rows - 1)),
      col: Math.max(0, Math.min(position.col, this._dimensions.cols - 1)),
    };
    this.triggerBufferUpdate();
  }

  saveCursorPosition(): void {
    this._savedCursor = { ...this._cursor };
  }

  restoreCursorPosition(): void {
    if (this._savedCursor) {
      this._cursor = { ...this._savedCursor };
      this.triggerBufferUpdate();
    }
  }

  writeCells(
    cells: Cell[],
    charsetType: CharacterSet = CharacterSet.USASCII
  ): void {
    this.beginBatchUpdate();
    for (const cell of cells) {
      if (this._cursor.col >= this._dimensions.cols - 1) {
        this.handleNewline();
        this.handleCarriageReturn();
      }

      const mappedChar = this.mapCharacter(cell.char, charsetType);
      const newCell: Cell = {
        ...cell,
        char: mappedChar,
        isDirty: true,
      };

      this._buffer[this._cursor.row][this._cursor.col] = newCell;
      this._hasChanges = true;
      this.moveCursorRelative(0, 1);
    }
    this.endBatchUpdate();
  }

  // Line operations
  insertLines(count: number): void {
    const start = this._cursor.row;
    const end = this._dimensions.rows;

    // Move existing lines down
    for (let i = end - count - 1; i >= start; i--) {
      this._buffer[i + count] = [...this._buffer[i]];
    }

    // Fill new lines with empty cells
    for (let i = 0; i < count && start + i < end; i++) {
      this._buffer[start + i] = Array(this._dimensions.cols)
        .fill(null)
        .map(() => createEmptyCell());
    }

    this._hasChanges = true;
    this.triggerBufferUpdate();
  }

  deleteLines(count: number): void {
    const start = this._cursor.row;
    const end = this._dimensions.rows;

    // Move lines up
    for (let i = start + count; i < end; i++) {
      this._buffer[i - count] = [...this._buffer[i]];
    }

    // Fill bottom lines with empty cells
    for (let i = end - count; i < end; i++) {
      this._buffer[i] = Array(this._dimensions.cols)
        .fill(null)
        .map(() => createEmptyCell());
    }

    this._hasChanges = true;
    this.triggerBufferUpdate();
  }

  clearLine(mode: "start" | "end" | "all"): void {
    const row = this._cursor.row;
    const emptyCell = createEmptyCell();

    switch (mode) {
      case "start":
        for (let col = 0; col <= this._cursor.col; col++) {
          this._buffer[row][col] = { ...emptyCell };
        }
        break;
      case "end":
        for (let col = this._cursor.col; col < this._dimensions.cols; col++) {
          this._buffer[row][col] = { ...emptyCell };
        }
        break;
      case "all":
        this._buffer[row] = Array(this._dimensions.cols)
          .fill(null)
          .map(() => ({ ...emptyCell }));
        break;
    }

    this.triggerBufferUpdate();
  }

  // Cell operations
  insertCells(count: number): void {
    const row = this._cursor.row;
    const start = this._cursor.col;

    // Move existing cells right
    for (let col = this._dimensions.cols - count - 1; col >= start; col--) {
      this._buffer[row][col + count] = { ...this._buffer[row][col] };
    }

    // Fill new cells with spaces
    for (
      let col = start;
      col < start + count && col < this._dimensions.cols;
      col++
    ) {
      this._buffer[row][col] = createEmptyCell();
    }

    this.triggerBufferUpdate();
  }

  deleteCells(count: number): void {
    const row = this._cursor.row;
    const start = this._cursor.col;

    // Move cells left
    for (let col = start + count; col < this._dimensions.cols; col++) {
      this._buffer[row][col - count] = { ...this._buffer[row][col] };
    }

    // Fill end with spaces
    for (
      let col = this._dimensions.cols - count;
      col < this._dimensions.cols;
      col++
    ) {
      this._buffer[row][col] = createEmptyCell();
    }

    this.triggerBufferUpdate();
  }

  bell() {
    this.emit("bell");
  }

  // Buffer operations
  clearScreen(mode: "start" | "end" | "all"): void {
    const emptyCell: Cell = {
      char: " ",
      attributes: {},
      isDirty: true,
    };

    switch (mode) {
      case "start":
        for (let row = 0; row <= this._cursor.row; row++) {
          this._buffer[row] = Array(this._dimensions.cols)
            .fill(null)
            .map(() => ({ ...emptyCell }));
        }
        break;
      case "end":
        // Clear from cursor to end of current line
        for (let col = this._cursor.col; col < this._dimensions.cols; col++) {
          this._buffer[this._cursor.row][col] = { ...emptyCell };
        }
        // Clear all lines below
        for (
          let row = this._cursor.row + 1;
          row < this._dimensions.rows;
          row++
        ) {
          this._buffer[row] = Array(this._dimensions.cols)
            .fill(null)
            .map(() => ({ ...emptyCell }));
        }
        break;
      case "all":
        DebugLogger.log("Clearing whole screen");
        this._buffer = this.createEmptyBuffer(this._dimensions, true);
    }

    this._hasChanges = true;
    this.triggerBufferUpdate();
  }

  scrollUp(count: number): void {
    const start = this._scrollRegion.top;
    const end = this._scrollRegion.bottom;

    // If no scroll region is set, use the entire screen
    if (start === 0 && end === 0) {
      // Move lines up
      for (let i = count; i < this._dimensions.rows; i++) {
        this._buffer[i - count] = [...this._buffer[i]];
      }

      // Fill bottom lines with empty cells
      for (
        let i = this._dimensions.rows - count;
        i < this._dimensions.rows;
        i++
      ) {
        this._buffer[i] = Array(this._dimensions.cols)
          .fill(null)
          .map(() => createEmptyCell());
      }
    } else {
      // Move lines up within the scroll region
      for (let i = start + count; i <= end; i++) {
        this._buffer[i - count] = [...this._buffer[i]];
      }

      // Fill bottom of scroll region with empty cells
      for (let i = end - count + 1; i <= end; i++) {
        this._buffer[i] = Array(this._dimensions.cols)
          .fill(null)
          .map(() => createEmptyCell());
      }
    }

    this.triggerBufferUpdate();
  }

  scrollDown(count: number): void {
    const start = this._scrollRegion.top;
    const end = this._scrollRegion.bottom;

    // If no scroll region is set, use the entire screen
    if (start === 0 && end === 0) {
      // Move lines down
      for (let i = this._dimensions.rows - count - 1; i >= 0; i--) {
        this._buffer[i + count] = [...this._buffer[i]];
      }

      // Fill top lines with empty cells
      for (let i = 0; i < count; i++) {
        this._buffer[i] = Array(this._dimensions.cols)
          .fill(null)
          .map(() => createEmptyCell());
      }
    } else {
      // Move lines down within the scroll region
      for (let i = end - count; i >= start; i--) {
        this._buffer[i + count] = [...this._buffer[i]];
      }

      // Fill top of scroll region with empty cells
      for (let i = start; i < start + count && i <= end; i++) {
        this._buffer[i] = Array(this._dimensions.cols)
          .fill(null)
          .map(() => createEmptyCell());
      }
    }

    this.triggerBufferUpdate();
  }

  setWindowTitle(title: string): void {
    this.windowTitle = title;
  }

  setIconName(name: string): void {
    this.iconName = name;
  }

  setWorkingDir(dir: string): void {
    this.workingDir = dir;
  }

  onBufferUpdate(callback: (buffer: PanelBuffer) => void): void {
    this.on("bufferUpdate", callback);
  }

  onResize(callback: (dimensions: Dimensions) => void): void {
    this.on("resize", callback);
  }

  onFocus(callback: () => void): void {
    this.on("focus", callback);
  }

  onBlur(callback: () => void): void {
    this.on("blur", callback);
  }

  processData(data: string): void {
    for (const sequence of this._parser.parseString(data)) {
      DebugLogger.log("", VT100Formatter.format(sequence));
      this.handleSequence(sequence);
    }
  }

  getCursorPosition(): CursorPosition {
    return { ...this._cursor };
  }

  moveCursorTo(row: number, col: number): void {
    this._cursor = {
      row: Math.max(0, Math.min(row, this._dimensions.rows - 1)),
      col: Math.max(0, Math.min(col, this._dimensions.cols - 1)),
    };
    // DebugLogger.log(`Cursor: ${this._cursor.row}, ${this._cursor.col}`);
    this.triggerBufferUpdate();
  }

  handleCarriageReturn(): void {
    this.moveCursorTo(this._cursor.row, 0);
    this.forceHasChanges();
  }

  handleNewline(): void {
    const nextRow = this._cursor.row + 1;
    const inScrollRegion =
      this._scrollRegion.top !== 0 || this._scrollRegion.bottom !== 0;

    if (inScrollRegion) {
      // If we're within the scroll region
      if (
        this._cursor.row >= this._scrollRegion.top &&
        this._cursor.row <= this._scrollRegion.bottom
      ) {
        if (nextRow > this._scrollRegion.bottom) {
          this.scrollUp(1);
          this.moveCursorTo(this._scrollRegion.bottom, this._cursor.col);
        } else {
          this.moveCursorTo(nextRow, this._cursor.col);
        }
      } else {
        // Outside scroll region, normal behavior
        if (nextRow >= this._dimensions.rows) {
          this.scrollUp(1);
          this.moveCursorTo(this._dimensions.rows - 1, this._cursor.col);
        } else {
          this.moveCursorTo(nextRow, this._cursor.col);
        }
      }
    } else {
      // No scroll region set, use original behavior
      if (nextRow >= this._dimensions.rows) {
        this.scrollUp(1);
        this.moveCursorTo(this._dimensions.rows - 1, this._cursor.col);
      } else {
        this.moveCursorTo(nextRow, this._cursor.col);
      }
    }
  }

  handleBackspace(): void {
    if (this._cursor.col > 0) {
      // Move cursor back one position
      this.moveCursorTo(this._cursor.row, this._cursor.col - 1);

      // Clear the character at the new cursor position
      this._buffer[this._cursor.row][this._cursor.col] = createEmptyCell();
      this.markCellDirty(this._cursor.row, this._cursor.col);

      this.triggerBufferUpdate();
    } else if (this._cursor.row > 0) {
      // If at start of line and not at top, move to end of previous line
      this.moveCursorTo(this._cursor.row - 1, this._dimensions.cols - 1);
      this._buffer[this._cursor.row][this._cursor.col] = createEmptyCell();
      this.markCellDirty(this._cursor.row, this._cursor.col);

      this.triggerBufferUpdate();
    }
  }

  moveCursorRelative(deltaRow: number, deltaCol: number): void {
    this.moveCursorTo(this._cursor.row + deltaRow, this._cursor.col + deltaCol);
  }

  forceHasChanges() {
    this._hasChanges = true;
    this.triggerBufferUpdate();
  }

  hasChanges(): boolean {
    return this._hasChanges;
  }

  resize(dimensions: Dimensions): void {
    // Don't do anything if dimensions haven't changed
    if (
      dimensions.rows === this._dimensions.rows &&
      dimensions.cols === this._dimensions.cols
    ) {
      return;
    }

    // Create new buffer with new dimensions
    const newBuffer = this.createEmptyBuffer(dimensions);

    // Copy existing content to new buffer
    const copyRows = Math.min(dimensions.rows, this._dimensions.rows);
    const copyCols = Math.min(dimensions.cols, this._dimensions.cols);

    for (let row = 0; row < copyRows; row++) {
      for (let col = 0; col < copyCols; col++) {
        newBuffer[row][col] = { ...this._buffer[row][col] };
      }
    }

    // Update buffer and dimensions
    this._buffer = newBuffer;
    this._dimensions = { ...dimensions };

    // Adjust cursor position if it's now out of bounds
    this._cursor = {
      row: Math.min(this._cursor.row, dimensions.rows - 1),
      col: Math.min(this._cursor.col, dimensions.cols - 1),
    };

    // Adjust saved cursor position if it exists and is out of bounds
    if (this._savedCursor) {
      this._savedCursor = {
        row: Math.min(this._savedCursor.row, dimensions.rows - 1),
        col: Math.min(this._savedCursor.col, dimensions.cols - 1),
      };
    }

    // Adjust scroll region
    this._scrollRegion = {
      top: Math.min(this._scrollRegion.top, dimensions.rows - 1),
      bottom: Math.min(this._scrollRegion.bottom, dimensions.rows - 1),
    };

    // Reset tab stops for new width
    this._tabStops.clear();
    this.initializeTabStops();

    // Mark that changes occurred
    this._hasChanges = true;

    // Trigger resize and buffer update events
    this.triggerResize();
    this.triggerBufferUpdate();
  }

  clear(): void {}

  destroy(): void {}

  write(data: string): void {
    this.handleInput(data);
  }

  protected handleInput(data: string): void {}

  clearDirtyFlags(): void {
    for (let row = 0; row < this._dimensions.rows; row++) {
      for (let col = 0; col < this._dimensions.cols; col++) {
        this._buffer[row][col].isDirty = false;
      }
    }
    this._hasChanges = false;
  }
}
