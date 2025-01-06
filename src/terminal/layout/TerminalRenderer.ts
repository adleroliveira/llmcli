import {
  SequenceBuilder,
  SequenceProducer,
} from "../builder/SequenceBuilder.js";
import { Cursor } from "../builder/Cursor.js";
import { Text, TextStyle } from "../builder/Text.js";
import { Erase } from "../builder/Erase.js";
import { Screen } from "../builder/Screen.js";
import { TerminalBuffer, DirtyRegion } from "./TerminalBuffer.js";
import { DebugLogger } from "../DebugLogger.js";

export interface RendererOptions {
  useAlternateBuffer?: boolean;
}

interface CellBatch {
  x: number;
  y: number;
  chars: string;
  attributes: any;
}

export class TerminalRenderer {
  private previousBuffer: TerminalBuffer | null = null;
  private currentPosition: { x: number; y: number } = { x: 0, y: 0 };
  private currentAttributes: any = null;
  private readonly options: Required<RendererOptions>;

  constructor(options: RendererOptions = {}) {
    this.options = {
      useAlternateBuffer: options.useAlternateBuffer ?? true,
    };
  }

  initialize(): string {
    const builder = SequenceBuilder.create();

    builder.add(Screen.resetLineWrap());

    if (this.options.useAlternateBuffer) {
      builder.add(Screen.alternateBuffer(true));
    }

    builder.add(Erase.display()).add(Cursor.moveTo({ row: 1, column: 1 }));

    return builder.build();
  }

  cleanup(): string {
    const builder = SequenceBuilder.create();

    // Always show cursor on cleanup
    builder.add(Cursor.show());

    if (this.options.useAlternateBuffer) {
      builder.add(Screen.alternateBuffer(false));
    }

    return builder.build();
  }

  render(
    buffer: TerminalBuffer,
    cursorPosition: { x: number; y: number } | null = null
  ): string {
    const builder = SequenceBuilder.create();
    const dirtyRegions = buffer.getDirtyRegions();

    if (
      !this.previousBuffer ||
      this.previousBuffer.width !== buffer.width ||
      this.previousBuffer.height !== buffer.height
    ) {
      this.renderFull(buffer, builder);
    } else {
      this.renderIncremental(buffer, builder, dirtyRegions);
    }

    if (cursorPosition !== null) {
      // Add 1 to convert from 0-based to 1-based terminal coordinates
      builder.add(
        Cursor.moveTo({
          row: cursorPosition.y + 1,
          column: cursorPosition.x + 1,
        })
      );
      builder.add(Cursor.show());
    } else {
      builder.add(Cursor.hide());
    }

    this.previousBuffer = buffer.copy();
    buffer.clearDirty();

    return builder.build();
  }

  private renderFull(buffer: TerminalBuffer, builder: SequenceBuilder): void {
    builder.add(Erase.display()).add(Cursor.moveTo({ row: 1, column: 1 }));

    this.currentPosition = { x: 0, y: 0 };
    this.currentAttributes = null;

    // In a full render, we should render every cell regardless of previous state
    let currentBatch: CellBatch | null = null;

    for (let y = 0; y < buffer.height; y++) {
      for (let x = 0; x < buffer.width; x++) {
        const cell = buffer.getCell(x, y);
        if (!cell) continue;

        if (!currentBatch) {
          currentBatch = {
            x,
            y,
            chars: cell.char,
            attributes: cell.attributes,
          };
        } else if (this.canBatchWith(currentBatch, cell, x, y)) {
          currentBatch.chars += cell.char;
        } else {
          this.renderBatch(currentBatch, builder);
          currentBatch = {
            x,
            y,
            chars: cell.char,
            attributes: cell.attributes,
          };
        }
      }

      if (currentBatch) {
        this.renderBatch(currentBatch, builder);
        currentBatch = null;
      }
    }
  }

  private renderIncremental(
    buffer: TerminalBuffer,
    builder: SequenceBuilder,
    dirtyRegions: DirtyRegion[]
  ): void {
    // If no dirty regions but buffer is different size, force full render
    if (
      dirtyRegions.length === 0 &&
      (this.previousBuffer?.width !== buffer.width ||
        this.previousBuffer?.height !== buffer.height)
    ) {
      this.renderFull(buffer, builder);
      return;
    }

    for (const region of dirtyRegions) {
      this.renderCells(
        buffer,
        region.x,
        region.y,
        region.width,
        region.height,
        builder
      );
    }
  }

  private renderCells(
    buffer: TerminalBuffer,
    startX: number,
    startY: number,
    width: number,
    height: number,
    builder: SequenceBuilder
  ): void {
    let currentBatch: CellBatch | null = null;

    for (let y = startY; y < startY + height; y++) {
      for (let x = startX; x < startX + width; x++) {
        const cell = buffer.getCell(x, y);
        if (!cell) {
          continue;
        }

        const prevCell = this.previousBuffer?.getCell(x, y);
        if (prevCell && this.areCellsEqual(cell, prevCell)) {
          continue;
        }

        if (!currentBatch) {
          currentBatch = {
            x,
            y,
            chars: cell.char,
            attributes: cell.attributes,
          };
        } else if (this.canBatchWith(currentBatch, cell, x, y)) {
          currentBatch.chars += cell.char;
        } else {
          this.renderBatch(currentBatch, builder);
          currentBatch = {
            x,
            y,
            chars: cell.char,
            attributes: cell.attributes,
          };
        }
      }

      if (currentBatch) {
        this.renderBatch(currentBatch, builder);
        currentBatch = null;
      }
    }
  }

  private canBatchWith(
    batch: CellBatch,
    cell: any,
    x: number,
    y: number
  ): boolean {
    // Deep compare the attributes instead of using JSON.stringify
    const attributesEqual = this.areAttributesEqual(
      cell.attributes,
      batch.attributes
    );

    return (
      y === batch.y && // Same line
      x === batch.x + batch.chars.length && // Consecutive position
      attributesEqual && // Same attributes (using deep comparison)
      batch.chars.length < 100 // Prevent overly long batches
    );
  }

  private renderBatch(batch: CellBatch, builder: SequenceBuilder): void {
    // Move cursor if needed
    if (
      this.currentPosition.x !== batch.x ||
      this.currentPosition.y !== batch.y
    ) {
      builder.add(Cursor.moveTo({ row: batch.y + 1, column: batch.x + 1 }));
      this.currentPosition = { x: batch.x, y: batch.y };
    }

    // Update attributes if changed
    if (
      !this.currentAttributes ||
      !this.areAttributesEqual(this.currentAttributes, batch.attributes)
    ) {
      const style: TextStyle = {
        ...batch.attributes,
        color: batch.attributes.foregroundColor,
        backgroundColor: batch.attributes.backgroundColor,
      };
      builder.add(Text.formatted(batch.chars, style));
      this.currentAttributes = { ...batch.attributes }; // Make a copy of the attributes
    } else {
      // Just output text if attributes haven't changed
      builder.add(Text.plain(batch.chars));
    }

    this.currentPosition.x += batch.chars.length;
  }

  private areCellsEqual(cell1: any, cell2: any): boolean {
    return (
      cell1.char === cell2.char &&
      this.areAttributesEqual(cell1.attributes, cell2.attributes)
    );
  }

  private areAttributesEqual(attrs1: any, attrs2: any): boolean {
    if (!attrs1 || !attrs2) return attrs1 === attrs2;

    // Explicitly handle foreground and background colors
    const normalizedAttrs1 = {
      ...attrs1,
      color: attrs1.foregroundColor || attrs1.color,
      backgroundColor: attrs1.backgroundColor,
    };

    const normalizedAttrs2 = {
      ...attrs2,
      color: attrs2.foregroundColor || attrs2.color,
      backgroundColor: attrs2.backgroundColor,
    };

    const keys1 = Object.keys(normalizedAttrs1);
    const keys2 = Object.keys(normalizedAttrs2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every((key) => {
      if (
        typeof normalizedAttrs1[key] === "object" &&
        normalizedAttrs1[key] !== null
      ) {
        return this.areAttributesEqual(
          normalizedAttrs1[key],
          normalizedAttrs2[key]
        );
      }
      return normalizedAttrs1[key] === normalizedAttrs2[key];
    });
  }
}
