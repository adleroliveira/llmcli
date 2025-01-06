import { SGRColor } from "../CSISequence.js";

// Basic types for terminal UI positioning and sizing
export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Rect = Position & Size;

export type Constraints = {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
};

// Flex direction for layout
export type FlexDirection = "row" | "column";

export interface Cell {
  char: string;
  attributes: {
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
    blink?: boolean;
    inverse?: boolean;
    hidden?: boolean;
    strikethrough?: boolean;
    foreground?: string;
    background?: string;
    color?: SGRColor | { r: number; g: number; b: number } | number;
    foregroundColor?: SGRColor | { r: number; g: number; b: number } | number;
    backgroundColor?: SGRColor | { r: number; g: number; b: number } | number;
  };
  isDirty: boolean;
}

export interface ViewportState {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

function createEmptyCell(dirty: boolean = true): Cell {
  return {
    char: "",
    attributes: {},
    isDirty: dirty,
  };
}

export class Buffer {
  private cells: Cell[][];
  private _width: number;
  private _height: number;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this.cells = this.createEmptyBuffer(width, height);
  }

  private createEmptyBuffer(width: number, height: number): Cell[][] {
    return Array(height)
      .fill(null)
      .map(() => Array(width).fill(null).map(createEmptyCell));
  }

  public resize(width: number, height: number): void {
    const newBuffer = this.createEmptyBuffer(width, height);

    // Copy existing content that fits in the new size
    for (let y = 0; y < Math.min(this._height, height); y++) {
      for (let x = 0; x < Math.min(this._width, width); x++) {
        newBuffer[y][x] = this.cells[y][x];
      }
    }

    this._width = width;
    this._height = height;
    this.cells = newBuffer;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public getCell(x: number, y: number): Cell | null {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return null;
    }
    return this.cells[y][x];
  }

  public setCell(x: number, y: number, cell: Cell): void {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return;
    }
    this.cells[y][x] = cell;
  }

  public clear(): void {
    this.cells = this.createEmptyBuffer(this._width, this._height);
  }

  // Composite another buffer onto this one at a specific position
  public composite(other: Buffer, position: Position): void {
    for (let y = 0; y < other.height; y++) {
      for (let x = 0; x < other.width; x++) {
        const sourceCell = other.getCell(x, y);
        if (sourceCell) {
          this.setCell(x + position.x, y + position.y, { ...sourceCell });
        }
      }
    }
  }
}

// Base element that all terminal UI components will extend from
export abstract class TerminalElement {
  private _rect: Rect;
  private _constraints: Constraints;
  protected buffer: Buffer;
  protected parent: TerminalElement | null;
  protected children: TerminalElement[];
  protected needsRerender: boolean;

  constructor(rect: Rect, constraints: Constraints) {
    this._rect = rect;
    this._constraints = constraints;
    this.buffer = new Buffer(rect.width, rect.height);
    this.parent = null;
    this.children = [];
    this.needsRerender = true;
  }

  public get rect(): Rect {
    return this._rect;
  }

  public set rect(value: Rect) {
    // Ensure we respect constraints
    const width = Math.max(
      this._constraints.minWidth,
      this._constraints.maxWidth
        ? Math.min(value.width, this._constraints.maxWidth)
        : value.width
    );

    const height = Math.max(
      this._constraints.minHeight,
      this._constraints.maxHeight
        ? Math.min(value.height, this._constraints.maxHeight)
        : value.height
    );

    this._rect = {
      x: value.x,
      y: value.y,
      width,
      height,
    };

    // Resize buffer if dimensions changed
    if (this.buffer.width !== width || this.buffer.height !== height) {
      this.buffer.resize(width, height);
      this.needsRerender = true;
    }
  }

  public get constraints(): Constraints {
    return this._constraints;
  }

  // Tree operations
  public addChild(child: TerminalElement): void {
    this.children.push(child);
    child.parent = this;
    this.needsRerender = true;
  }

  public removeChild(child: TerminalElement): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
      this.needsRerender = true;
    }
  }

  // Layout and rendering
  public abstract calculateLayout(): void;
  protected abstract renderSelf(): void;

  public render(): Buffer {
    if (this.needsRerender) {
      this.renderSelf();
      this.needsRerender = false;
    }
    return this.buffer;
  }
}
