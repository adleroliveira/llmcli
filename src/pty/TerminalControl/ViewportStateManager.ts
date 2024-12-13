import { VT100Sequence } from "./Command.js";
import { CSISequence } from "./CSISequence.js";
import { TerminalController } from "./TerminalController.js";

export interface ViewportState {
  width: number;
  height: number;
  scrollTop: number;
  scrollBottom: number;
}

export class ViewportStateManager {
  private terminalController: TerminalController;

  constructor(controller: TerminalController) {
    this.terminalController = controller;
  }

  private state: ViewportState = {
    width: 80, // Default terminal width
    height: 24, // Default terminal height
    scrollTop: 0,
    scrollBottom: 23, // Default to height - 1
  };

  // Get current viewport state
  public getState(): ViewportState {
    return { ...this.state };
  }

  public processSequence(sequence: VT100Sequence): void {
    if (sequence instanceof CSISequence) {
      switch (sequence.finalByte) {
        case 0x72: // 'r' - DECSTBM (Set Top and Bottom Margins)
          this.handleSetScrollMargins(sequence);
          break;
        case 0x74: // 't' - Window manipulation
          this.handleWindowManipulation(sequence);
          break;
      }
    }

    // Ensure scroll region stays within bounds after any changes
    this.enforceScrollBounds();
  }

  private handleSetScrollMargins(sequence: CSISequence): void {
    // DECSTBM - Set Top and Bottom Margins
    const top = (sequence.parameters[0]?.value ?? 1) - 1;
    const bottom = (sequence.parameters[1]?.value ?? this.state.height) - 1;

    if (top < bottom && bottom < this.state.height) {
      this.state.scrollTop = top;
      this.state.scrollBottom = bottom;
    }
  }

  private handleWindowManipulation(sequence: CSISequence): void {
    const operation = sequence.parameters[0]?.value ?? 0;

    switch (operation) {
      case 8: // Resize terminal window
        const rows = sequence.parameters[1]?.value ?? null;
        const cols = sequence.parameters[2]?.value ?? null;

        if (rows !== null && cols !== null) {
          this.resize(cols, rows);
        }
        break;

      case 18: // Report terminal size in characters
      case 19: // Report terminal size in pixels
        // These would typically trigger a response back to the application
        // Implementation would depend on your terminal communication system
        break;
    }
  }

  private enforceScrollBounds(): void {
    // Ensure scroll region is within viewport bounds
    this.state.scrollTop = Math.max(
      0,
      Math.min(this.state.scrollTop, this.state.height - 1)
    );
    this.state.scrollBottom = Math.max(
      this.state.scrollTop,
      Math.min(this.state.scrollBottom, this.state.height - 1)
    );
  }

  // Public methods for viewport manipulation

  public resize(width: number, height: number): void {
    const oldHeight = this.state.height;
    this.state.width = Math.max(1, width);
    this.state.height = Math.max(1, height);

    // Always reset scroll region when height changes
    if (oldHeight !== height) {
      this.state.scrollTop = 0;
      this.state.scrollBottom = height - 1;
    }

    this.enforceScrollBounds();
    this.terminalController.getCursorStateManager().enforceBounds();
  }

  public setScrollRegion(top: number, bottom: number): void {
    if (top < bottom && bottom < this.state.height) {
      this.state.scrollTop = top;
      this.state.scrollBottom = bottom;
      this.enforceScrollBounds();
    }
  }

  public reset(): void {
    this.state = {
      width: this.state.width, // Preserve current dimensions
      height: this.state.height,
      scrollTop: 0,
      scrollBottom: this.state.height - 1,
    };
  }

  // Utility methods for scroll region calculations

  public isWithinScrollRegion(line: number): boolean {
    return line >= this.state.scrollTop && line <= this.state.scrollBottom;
  }

  public getScrollRegionHeight(): number {
    return this.state.scrollBottom - this.state.scrollTop + 1;
  }
}
