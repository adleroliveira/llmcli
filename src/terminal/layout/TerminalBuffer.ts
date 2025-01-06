import { Position, Rect } from ".";
import { DebugLogger } from "../DebugLogger.js";

export enum SGRColor {
  // Foreground colors
  Black = 30,
  Red = 31,
  Green = 32,
  Yellow = 33,
  Blue = 34,
  Magenta = 35,
  Cyan = 36,
  White = 37,
  Default = 39,

  // Background colors
  BgBlack = 40,
  BgRed = 41,
  BgGreen = 42,
  BgYellow = 43,
  BgBlue = 44,
  BgMagenta = 45,
  BgCyan = 46,
  BgWhite = 47,
  BgDefault = 49,

  // Bright foreground colors
  BrightBlack = 90,
  BrightRed = 91,
  BrightGreen = 92,
  BrightYellow = 93,
  BrightBlue = 94,
  BrightMagenta = 95,
  BrightCyan = 96,
  BrightWhite = 97,

  // Bright background colors
  BgBrightBlack = 100,
  BgBrightRed = 101,
  BgBrightGreen = 102,
  BgBrightYellow = 103,
  BgBrightBlue = 104,
  BgBrightMagenta = 105,
  BgBrightCyan = 106,
  BgBrightWhite = 107,
}

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
    backgroundColor?: SGRColor | { r: number; g: number; b: number } | number;
  };
  transparent?: boolean;
  isDirty: boolean;
}

function createEmptyCell(dirty: boolean = true): Cell {
  return {
    char: " ",
    attributes: {},
    isDirty: dirty,
  };
}

export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class TerminalBuffer {
  private _cells: Cell[][];
  private _width: number;
  private _height: number;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this._cells = this.createEmptyBuffer(width, height);
  }
  private dirtyRegions: DirtyRegion[] = [];

  private createEmptyBuffer(width: number, height: number): Cell[][] {
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => createEmptyCell())
    );
  }

  private areAttributesEqual(
    attrs1: Cell["attributes"],
    attrs2: Cell["attributes"]
  ): boolean {
    const keys1 = Object.keys(attrs1);
    const keys2 = Object.keys(attrs2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every((key) => {
      const val1 = attrs1[key as keyof Cell["attributes"]];
      const val2 = attrs2[key as keyof Cell["attributes"]];

      if (typeof val1 === "object" && val1 !== null) {
        return JSON.stringify(val1) === JSON.stringify(val2);
      }

      return val1 === val2;
    });
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public resize(width: number, height: number): void {
    const newBuffer = this.createEmptyBuffer(width, height);
    this._width = width;
    this._height = height;
    this._cells = newBuffer;

    // Clear existing dirty regions and mark the entire new buffer
    this.dirtyRegions = [
      {
        x: 0,
        y: 0,
        width: width,
        height: height,
      },
    ];
  }

  public clearDirty(): void {
    this.dirtyRegions = [];
  }

  public getDirtyRegions(): DirtyRegion[] {
    return [...this.dirtyRegions];
  }

  public markDirty(region: Rect): void {
    const merged = this.dirtyRegions.find(
      (r) =>
        r.x <= region.x + region.width &&
        r.x + r.width >= region.x &&
        r.y <= region.y + region.height &&
        r.y + r.height >= region.y
    );

    if (merged) {
      const x1 = Math.min(merged.x, region.x);
      const y1 = Math.min(merged.y, region.y);
      const x2 = Math.max(merged.x + merged.width, region.x + region.width);
      const y2 = Math.max(merged.y + merged.height, region.y + region.height);

      merged.x = x1;
      merged.y = y1;
      merged.width = x2 - x1;
      merged.height = y2 - y1;
    } else {
      this.dirtyRegions.push(region);
    }
  }

  public getCell(x: number, y: number): Cell | null {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return null;
    }
    return this._cells[y][x];
  }

  public setCell(x: number, y: number, cell: Cell): void {
    if (x < 0 || x >= this._width || y < 0 || y >= this._height) {
      return;
    }
    this._cells[y][x] = cell;
  }

  setCharacter(x: number, y: number, char: string): void {
    const cell: Cell = {
      char: char[0], // Take only the first character if string is longer
      attributes: {}, // Default attributes
      isDirty: true,
    };
    this.setCell(x, y, cell);
  }

  setCharacterWithAttributes(
    x: number,
    y: number,
    char: string,
    attributes: Cell["attributes"]
  ): void {
    const cell: Cell = {
      char: char[0],
      attributes: { ...attributes },
      isDirty: true,
    };
    this.setCell(x, y, cell);
  }

  public setCharactersWithAttributes(
    x: number,
    y: number,
    chars: string,
    attributes: Cell["attributes"]
  ): void {
    for (let i = 0; i < chars.length; i++) {
      this.setCharacterWithAttributes(x + i, y, chars[i], attributes);
    }
  }

  public *cells(): Generator<[number, number, Cell]> {
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        yield [x, y, this._cells[y][x]];
      }
    }
  }

  public clear(): void {
    this._cells = this.createEmptyBuffer(this._width, this._height);
    // Mark entire buffer as dirty after clear
    this.markDirty({
      x: 0,
      y: 0,
      width: this._width,
      height: this._height,
    });
  }

  public applyStyle(rect: Rect, attributes: Cell["attributes"]): void {
    const startX = Math.max(0, rect.x);
    const startY = Math.max(0, rect.y);
    const endX = Math.min(this._width, rect.x + rect.width);
    const endY = Math.min(this._height, rect.y + rect.height);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = this.getCell(x, y);
        if (cell) {
          cell.attributes = { ...cell.attributes, ...attributes };
          cell.isDirty = true;
        }
      }
    }
  }

  public composite(
    other: TerminalBuffer,
    position: Position,
    clip?: Rect
  ): void {
    if (
      position.x >= this._width ||
      position.y >= this._height ||
      position.x + other.width <= 0 ||
      position.y + other.height <= 0
    ) {
      return;
    }

    const startX = Math.max(0, position.x);
    const startY = Math.max(0, position.y);
    const endX = Math.min(this._width, position.x + other.width);
    const endY = Math.min(this._height, position.y + other.height);

    // Copy cells
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const sourceCell = other.getCell(x - position.x, y - position.y);
        if (sourceCell) {
          this.setCell(x, y, { ...sourceCell });
        }
      }
    }

    // Mark the composited region as dirty
    this.markDirty({
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
    });
  }

  public getClippedRegion(rect: Rect): TerminalBuffer {
    const startX = Math.max(0, rect.x);
    const startY = Math.max(0, rect.y);
    const endX = Math.min(this._width, rect.x + rect.width);
    const endY = Math.min(this._height, rect.y + rect.height);

    const clippedWidth = endX - startX;
    const clippedHeight = endY - startY;

    const clippedBuffer = new TerminalBuffer(clippedWidth, clippedHeight);

    for (let y = 0; y < clippedHeight; y++) {
      for (let x = 0; x < clippedWidth; x++) {
        const sourceCell = this.getCell(startX + x, startY + y);
        if (sourceCell) {
          clippedBuffer.setCell(x, y, { ...sourceCell });
        }
      }
    }

    return clippedBuffer;
  }

  public isRegionEqual(
    other: TerminalBuffer,
    sourceRect: Rect,
    targetPos: Position
  ): boolean {
    const startX = Math.max(0, sourceRect.x);
    const startY = Math.max(0, sourceRect.y);
    const endX = Math.min(this._width, sourceRect.x + sourceRect.width);
    const endY = Math.min(this._height, sourceRect.y + sourceRect.height);

    // Check if the target region is within the other buffer's bounds
    if (
      targetPos.x < 0 ||
      targetPos.y < 0 ||
      targetPos.x + (endX - startX) > other.width ||
      targetPos.y + (endY - startY) > other.height
    ) {
      return false;
    }

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const thisCell = this.getCell(x, y);
        const otherCell = other.getCell(
          targetPos.x + (x - startX),
          targetPos.y + (y - startY)
        );

        if (!thisCell || !otherCell) return false;

        // Compare cell contents and attributes
        if (
          thisCell.char !== otherCell.char ||
          thisCell.transparent !== otherCell.transparent ||
          !this.areAttributesEqual(thisCell.attributes, otherCell.attributes)
        ) {
          return false;
        }
      }
    }

    return true;
  }

  public *cellsInRegion(rect: Rect): Generator<[number, number, Cell]> {
    const startX = Math.max(0, rect.x);
    const startY = Math.max(0, rect.y);
    const endX = Math.min(this._width, rect.x + rect.width);
    const endY = Math.min(this._height, rect.y + rect.height);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = this.getCell(x, y);
        if (cell) {
          yield [x, y, cell];
        }
      }
    }
  }

  public getRegionAttributes(rect: Rect): Set<Cell["attributes"]> {
    const attributes = new Set<Cell["attributes"]>();
    const startX = Math.max(0, rect.x);
    const startY = Math.max(0, rect.y);
    const endX = Math.min(this._width, rect.x + rect.width);
    const endY = Math.min(this._height, rect.y + rect.height);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cell = this.getCell(x, y);
        if (cell && Object.keys(cell.attributes).length > 0) {
          attributes.add(cell.attributes);
        }
      }
    }

    return attributes;
  }

  public scroll(dx: number, dy: number): void {
    const newBuffer = this.createEmptyBuffer(this._width, this._height);

    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        const sourceX = x - dx;
        const sourceY = y - dy;
        if (
          sourceX >= 0 &&
          sourceX < this._width &&
          sourceY >= 0 &&
          sourceY < this._height
        ) {
          newBuffer[y][x] = this._cells[sourceY][sourceX];
        }
      }
    }

    this._cells = newBuffer;
  }

  public fill(rect: Rect, cell: Cell): void {
    const startX = Math.max(0, rect.x);
    const startY = Math.max(0, rect.y);
    const endX = Math.min(this._width, rect.x + rect.width);
    const endY = Math.min(this._height, rect.y + rect.height);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        this.setCell(x, y, { ...cell });
      }
    }
  }

  public mergeCell(target: Cell, source: Cell): Cell {
    if (source.transparent) return target;
    return {
      ...target,
      ...source,
      attributes: {
        ...target.attributes,
        ...source.attributes,
      },
    };
  }

  public copy(): TerminalBuffer {
    const newBuffer = new TerminalBuffer(this._width, this._height);
    for (const [x, y, cell] of this.cells()) {
      newBuffer.setCell(x, y, { ...cell });
    }
    return newBuffer;
  }

  public toString(): string {
    return this._cells
      .map((row) =>
        row.map((cell) => getTerminalSequence(cell) || " ").join("")
      )
      .join("\n");
  }
}

function getTerminalSequence(cell: Cell): string {
  if (!cell.isDirty) return cell.char;

  const codes = [SGRColor.White, SGRColor.BgRed];
  return `\x1b[${codes.join(";")}m${cell.char}\x1b[0m`;
}
