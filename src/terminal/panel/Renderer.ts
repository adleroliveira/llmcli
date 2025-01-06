import { BaseTerminalPanel } from "./BaseTerminalPanel.js";
import {
  SequenceBuilder,
  Cursor,
  Screen,
  Erase,
  EraseMode,
  Text,
} from "../builder/index.js";
import { Cell } from "./interfaces.js";

export class Renderer {
  private panels: BaseTerminalPanel[] = [];
  private focusedPanelIndex: number = -1;

  constructor() {}

  private convertToTerminalCoordinates(
    row: number,
    col: number
  ): { row: number; column: number } {
    return {
      row: row + 1,
      column: col + 1,
    };
  }

  getFocusedPanel(): BaseTerminalPanel | null {
    return this.focusedPanelIndex >= 0
      ? this.panels[this.focusedPanelIndex]
      : null;
  }

  addPanel(panel: BaseTerminalPanel, focus: boolean = false) {
    this.panels.push(panel);
    // TODO: schedule buffer update
    panel.on("bufferUpdate", this.drawBuffer.bind(this));
    if (focus) {
      this.focusedPanelIndex = this.panels.length - 1;
    }
  }

  initializeDisplay(panelIndex?: number): void {
    const focusedPanelIndex = panelIndex || this.getFocusedPanel();
    if (!focusedPanelIndex) return;

    const builder = SequenceBuilder.create();

    builder.add(Cursor.saveDEC());

    // Enable alternate buffer
    builder.add(Screen.alternateBuffer(true));

    // Clear the screen
    builder.add(Erase.display(EraseMode.All));

    // Set initial cursor position
    builder.add(Cursor.moveTo({ row: 1, column: 1 }));

    process.stdout.write(builder.build());
    this.drawBuffer();
  }

  cleanup(): void {
    const builder = SequenceBuilder.create();

    // Disable alternate buffer (which automatically restores the main buffer)
    builder.add(Screen.alternateBuffer(false));

    // Reset any styling
    builder.add(Text.reset());

    // Show cursor if it was hidden
    builder.add(Cursor.show());

    process.stdout.write(builder.build());
  }

  drawBuffer(): void {
    const panel = this.getFocusedPanel();
    if (!panel) return;

    if (!panel.hasChanges()) {
      return; // Skip drawing if nothing has changed
    }

    const drawSegment = (builder: SequenceBuilder, segment: Cell[]) => {
      const textSegments = segment.map((cell) => ({
        text: cell.char,
        style: cell.attributes,
      }));

      builder.add(Text.segments(textSegments));
    };

    const buffer = panel.getBuffer();
    const builder = SequenceBuilder.create();

    // Save cursor position
    builder.add(Cursor.save());

    let currentRow = -1;
    let currentCol = -1;

    // Only process dirty cells
    for (let row = 0; row < buffer.lines.length; row++) {
      const line = buffer.lines[row];
      let segmentStart = -1;
      let currentSegment: Cell[] = [];

      for (let col = 0; col < line.length; col++) {
        const cell = line[col];
        if (cell.isDirty) {
          // Start new segment if needed
          if (segmentStart === -1) {
            segmentStart = col;
            currentRow = row;
            currentCol = col;
            const terminalCoords = this.convertToTerminalCoordinates(row, col);
            builder.add(Cursor.moveTo(terminalCoords));
          }
          currentSegment.push(cell);
        } else if (segmentStart !== -1) {
          // Draw the accumulated segment
          drawSegment(builder, currentSegment);
          currentSegment = [];
          segmentStart = -1;
        }
      }

      // Draw any remaining segment at end of line
      if (currentSegment.length > 0) {
        drawSegment(builder, currentSegment);
        currentSegment = [];
        segmentStart = -1;
      }
    }

    // Restore cursor to its buffer position
    builder.add(
      Cursor.moveTo(
        this.convertToTerminalCoordinates(buffer.cursor.row, buffer.cursor.col)
      )
    );

    const data = builder.build();

    // Write the optimized sequence
    process.stdout.write(data);

    // Clear dirty flags
    panel.clearDirtyFlags();
  }
}
