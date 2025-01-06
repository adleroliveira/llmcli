import { SGRColor } from "../CSISequence.js";

// Core interfaces for panel dimensions and content
export interface Dimensions {
  rows: number;
  cols: number;
}

export interface CursorPosition {
  row: number;
  col: number;
}

// Cell interface for terminal attributes
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
  isDirty: boolean;
}

export interface TerminalOperations {
  // Cursor operations
  setCursorPosition(position: CursorPosition): void;
  saveCursorPosition(): void;
  restoreCursorPosition(): void;

  // Line operations
  insertLines(count: number): void;
  deleteLines(count: number): void;
  clearLine(mode: "start" | "end" | "all"): void;

  // Cell operations
  insertCells(count: number): void;
  deleteCells(count: number): void;

  // Buffer operations
  clearScreen(mode: "start" | "end" | "all"): void;
  scrollUp(count: number): void;
  scrollDown(count: number): void;

  // Write operations
  writeCells(cells: Cell[]): void;

  // Tab operations
  setTabStop(): void;
  clearTabStop(): void;
  clearAllTabStops(): void;
  handleTab(): void; // Moves cursor to next tab stop
}

// The visible state of a panel that can be used for rendering
export interface PanelBuffer {
  readonly lines: Cell[][]; // Each line is now an array of cells
  readonly cursor: CursorPosition;
  readonly dimensions: Dimensions;
}

// The main panel interface
export interface Panel {
  // Read-only properties
  readonly id: string;
  readonly dimensions: Dimensions;
  readonly focused: boolean;

  // Buffer access for rendering
  getBuffer(): PanelBuffer;
  hasChanges(): boolean;

  // Core methods
  write(data: string | Buffer): void; // Write data to panel, handling wrapping
  resize(dimensions: Dimensions): void; // Update panel dimensions
  clear(): void; // Clear panel content
  destroy(): void;
  clearDirtyFlags(): void;

  // Events
  onResize(callback: (dimensions: Dimensions) => void): void;
  onBufferUpdate(callback: (buffer: PanelBuffer) => void): void;
  onFocus(callback: () => void): void;
  onBlur(callback: () => void): void;
}

// Extend Panel interface to include terminal operations
export interface TerminalPanel extends Panel, TerminalOperations {
  readonly tabWidth: number;
  setTabWidth(width: number): void;
}

// Manager for creating and organizing panels
export interface PanelManager {
  createRootPanel(options?: {
    id?: string;
    scrollable?: boolean;
    maxBufferLines?: number;
  }): Panel;

  splitHorizontal(panel: Panel, ratio?: number): [Panel, Panel];
  splitVertical(panel: Panel, ratio?: number): [Panel, Panel];
  removePanel(panel: Panel): void;
  getPanel(id: string): Panel | null;

  // Focus management
  getFocusedPanel(): Panel | null;
  focusPanel(panel: Panel): void;
  focusNext(): void;
  focusPrevious(): void;
}

export interface TerminalContainer {
  readonly dimensions: Dimensions;
  readonly panelManager: PanelManager;

  // Input handling
  handleInput(data: string | Buffer): void;

  // Resize handling
  resize(dimensions: Dimensions): void;

  // Events
  onResize(callback: (dimensions: Dimensions) => void): void;
  onRender(callback: () => void): void;

  // Focus handling
  onFocusChange(callback: (panel: Panel) => void): void;
}
