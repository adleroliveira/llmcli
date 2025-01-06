import { Dimensions, PanelBuffer, Panel, Cell } from "./interfaces.js";
import {
  SequenceBuilder,
  Cursor,
  Screen,
  Erase,
  EraseMode,
  Text,
} from "../builder/index.js";
import { DebugLogger } from "../DebugLogger.js";
import { BaseTerminalPanel } from "./BaseTerminalPanel.js";

type SplitDirection = "horizontal" | "vertical";

interface Split {
  direction: SplitDirection;
  ratio: number;
}

class PanelNode {
  readonly panel: BaseTerminalPanel;
  public child: PanelNode | null = null;
  private split: Split | null = null;

  constructor(panel: BaseTerminalPanel) {
    this.panel = panel;
  }

  hasChanges(): boolean {
    return this.panel.hasChanges() || (this.child?.hasChanges() ?? false);
  }

  splitPanel(
    direction: SplitDirection,
    newPanel: BaseTerminalPanel,
    ratio: number = 0.5
  ): [BaseTerminalPanel, BaseTerminalPanel] {
    if (ratio <= 0 || ratio >= 1) {
      throw new Error("Split ratio must be between 0 and 1");
    }

    // Calculate new dimensions based on split direction and ratio
    const currentDims = this.panel.dimensions;
    let primaryDims: Dimensions;
    let secondaryDims: Dimensions;

    if (direction === "horizontal") {
      const primaryRows = Math.floor(currentDims.rows * ratio);
      const secondaryRows = currentDims.rows - primaryRows;
      primaryDims = { rows: primaryRows, cols: currentDims.cols };
      secondaryDims = { rows: secondaryRows, cols: currentDims.cols };
    } else {
      const primaryCols = Math.floor(currentDims.cols * ratio);
      const secondaryCols = currentDims.cols - primaryCols;
      primaryDims = { rows: currentDims.rows, cols: primaryCols };
      secondaryDims = { rows: currentDims.rows, cols: secondaryCols };
    }

    // Resize current panel
    this.panel.resize(primaryDims);

    // Create new panel node with adjusted dimensions
    newPanel.resize(secondaryDims);
    this.child = new PanelNode(newPanel);
    this.split = { direction, ratio };
    return [this.panel, newPanel];
  }

  destroyChild(): void {
    if (this.child) {
      this.child.destroy();
      this.child = null;
      this.split = null;

      // Resize current panel to take up full space
      const parentDims = this.panel.dimensions;
      this.panel.resize(parentDims);
    }
  }

  destroy(): void {
    if (this.child) {
      this.child.destroy();
    }
    this.panel.destroy();
  }

  getComposedBuffer(): PanelBuffer {
    const result = this.panel.getBuffer();

    if (this.child && this.split) {
      const childBuffers = this.child.getComposedBuffer();

      if (this.split.direction === "horizontal") {
        // Append child buffers as new rows
        result.lines.push(...childBuffers.lines);
      } else {
        // Append child buffers as new columns in each row
        result.lines[0].push(...childBuffers.lines[0]);
      }
    }

    return result;
  }

  resize(dimensions: Dimensions): void {
    if (!this.child || !this.split) {
      this.panel.resize(dimensions);
      return;
    }

    // Calculate new dimensions for both panels based on split
    let primaryDims: Dimensions;
    let secondaryDims: Dimensions;

    if (this.split.direction === "horizontal") {
      const primaryRows = Math.floor(dimensions.rows * this.split.ratio);
      const secondaryRows = dimensions.rows - primaryRows;
      primaryDims = { rows: primaryRows, cols: dimensions.cols };
      secondaryDims = { rows: secondaryRows, cols: dimensions.cols };
    } else {
      const primaryCols = Math.floor(dimensions.cols * this.split.ratio);
      const secondaryCols = dimensions.cols - primaryCols;
      primaryDims = { rows: dimensions.rows, cols: primaryCols };
      secondaryDims = { rows: dimensions.rows, cols: secondaryCols };
    }

    this.panel.resize(primaryDims);
    this.child.resize(secondaryDims);
  }

  findPanelById(id: string): PanelNode | null {
    if (this.panel.id === id) {
      return this;
    }
    if (this.child) {
      return this.child.findPanelById(id);
    }
    return null;
  }

  clearDirtyFlags() {
    this.panel.clearDirtyFlags();
    if (this.child) {
      this.child.clearDirtyFlags();
    }
  }
}

class PanelManager {
  private root: PanelNode;
  private dimensions: Dimensions;
  private hasChanges: boolean = false;
  private focusedPanel: BaseTerminalPanel;

  constructor(dimensions: Dimensions, rootPanel: BaseTerminalPanel) {
    this.dimensions = dimensions;
    this.root = new PanelNode(rootPanel);
    this.root.panel.on("bufferUpdate", this.drawBuffer.bind(this));
    this.focusedPanel = rootPanel;
    this.initializeDisplay();
  }

  private handleTabKey(data: string | Buffer): boolean {
    if (Buffer.isBuffer(data) && data[0] === 9) {
      this.toggleFocus();
      return true;
    }
    return false;
  }

  private toggleFocus(): void {
    const allPanels = this.getAllPanels();
    const currentIndex = allPanels.indexOf(this.focusedPanel);
    const nextIndex = (currentIndex + 1) % allPanels.length;
    this.focusedPanel = allPanels[nextIndex];

    // Update cursor position to focused panel
    const buffer = this.focusedPanel.getBuffer();
    const coords = this.convertToTerminalCoordinates(
      buffer.cursor.row,
      buffer.cursor.col
    );
    process.stdout.write(
      SequenceBuilder.create().add(Cursor.moveTo(coords)).build()
    );
  }

  private getAllPanels(): BaseTerminalPanel[] {
    const panels: BaseTerminalPanel[] = [];

    const traverse = (node: PanelNode) => {
      panels.push(node.panel);
      if (node.child) {
        traverse(node.child);
      }
    };

    traverse(this.root);
    return panels;
  }

  private convertToTerminalCoordinates(
    row: number,
    col: number
  ): { row: number; column: number } {
    return {
      row: row + 1,
      column: col + 1,
    };
  }

  setRoot(panel: BaseTerminalPanel): void {
    if (this.root) {
      this.root.destroy();
    }
    panel.resize(this.dimensions);
    panel.on("bufferUpdate", this.drawBuffer.bind(this));
    this.root = new PanelNode(panel);
  }

  splitPanel(
    panelId: string,
    direction: SplitDirection,
    newPanel: BaseTerminalPanel,
    ratio: number = 0.5
  ): boolean {
    const [_, child] = this.root.splitPanel(direction, newPanel, ratio);
    child.on("bufferUpdate", this.drawBuffer.bind(this));
    return true;
  }

  destroyPanel(panelId: string): boolean {
    if (!this.root) {
      return false;
    }

    if (this.root.panel.id === panelId) {
      this.root.destroy();
      process.exit(0);
    }

    const panelNode = this.root.findPanelById(panelId);
    if (!panelNode) {
      return false;
    }

    panelNode.destroyChild();
    return true;
  }

  resize(dimensions: Dimensions): void {
    this.dimensions = dimensions;
    if (this.root) {
      this.root.resize(dimensions);
    }
  }

  write(data: string, panelId?: string): boolean {
    DebugLogger.log(`data (${JSON.stringify(data)})`);
    if (this.handleTabKey(data)) {
      return true;
    }

    if (!this.root) {
      return false;
    }

    const panelNode = this.root.findPanelById(panelId || this.focusedPanel.id);
    if (!panelNode) {
      return false;
    }

    panelNode.panel.write(data);
    return true;
  }

  getBuffer(): PanelBuffer {
    return this.root.getComposedBuffer();
  }

  initializeDisplay(): void {
    const builder = SequenceBuilder.create();
    builder.add(Cursor.saveDEC());
    builder.add(Screen.alternateBuffer(true));
    builder.add(Erase.display(EraseMode.All));
    builder.add(Cursor.moveTo({ row: 1, column: 1 }));
    process.stdout.write(builder.build());
    this.drawBuffer();
  }

  cleanup(): void {
    const builder = SequenceBuilder.create();
    builder.add(Screen.alternateBuffer(false));
    builder.add(Text.reset());
    builder.add(Cursor.show());
    process.stdout.write(builder.build());
  }

  drawBuffer(): void {
    if (!this.root.hasChanges()) {
      DebugLogger.log("No changes to draw");
      return; // Skip drawing if nothing has changed
    }

    DebugLogger.log("Changes detected, drawing");

    const drawSegment = (builder: SequenceBuilder, segment: Cell[]) => {
      const textSegments = segment.map((cell) => ({
        text: cell.char,
        style: cell.attributes,
      }));

      builder.add(Text.segments(textSegments));
    };

    const buffer = this.getBuffer();
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
    this.root.clearDirtyFlags();
  }
}

export { PanelManager, type SplitDirection };
