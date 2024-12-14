import { VT100Sequence, ControlCharacter, SequenceType } from "./Command.js";
import { CSISequence } from "./CSISequence.js";
import { TerminalController } from "./TerminalController.js";
import { ViewportStateManager } from "./ViewportStateManager.js";

export interface CursorState {
  x: number;
  y: number;
  isVisible: boolean;
  isSaved: boolean;
  savedX?: number;
  savedY?: number;
}

export class CursorStateManager {
  private state: CursorState = {
    x: 0,
    y: 0,
    isVisible: true,
    isSaved: false,
  };

  private terminalController: TerminalController;
  private viewport: ViewportStateManager;

  private maxX: number = Infinity;
  private maxY: number = Infinity;

  constructor(controller: TerminalController) {
    this.terminalController = controller;
    this.viewport = controller.getViewPortStateManager();
  }

  // Get current cursor state
  public getState(): CursorState {
    return { ...this.state };
  }

  public processSequence(sequence: VT100Sequence): void {
    if (sequence instanceof CSISequence) {
      if (CSISequence.isCursorCommand(sequence)) {
        this.processCursorCommand(sequence);
      } else if (CSISequence.isCursorVisibilityCommand(sequence)) {
        this.state.isVisible = sequence.finalByte === 0x68;
      } else {
        switch (sequence.finalByte) {
          case 0x4a: // 'J' - ED (Erase in Display)
            this.handleEraseDisplay(sequence.parameters[0]?.value ?? 0);
            break;
          case 0x4b: // 'K' - EL (Erase in Line)
            this.handleEraseLine(sequence.parameters[0]?.value ?? 0);
            break;
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
    this.enforceBounds();
  }

  private handleLineFeed(): void {
    const viewportState = this.viewport.getState();
    const isInScrollRegion =
      this.state.y >= viewportState.scrollTop &&
      this.state.y <= viewportState.scrollBottom;

    if (isInScrollRegion) {
      if (this.state.y < viewportState.scrollBottom) {
        this.state.y++;
      }
      // If at scroll bottom, terminal will scroll content up instead of moving cursor
    } else {
      // Outside scroll region, move cursor if possible
      if (this.state.y < viewportState.height - 1) {
        this.state.y++;
      }
    }
  }

  private handleEraseDisplay(mode: number): void {
    switch (mode) {
      case 0: // Erase from cursor to end of display
        break;
      case 1: // Erase from start of display to cursor
        break;
      case 2: // Erase entire display
        this.state.x = 0;
        this.state.y = 0;
        break;
      case 3: // Erase saved lines (scrollback buffer)
        break;
    }
  }

  private handleEraseLine(mode: number): void {
    switch (mode) {
      case 0: // Erase from cursor to end of line
        break;
      case 1: // Erase from start of line to cursor
        break;
      case 2: // Erase entire line
        this.state.x = 0;
        break;
    }
  }

  private processText(text: string): void {
    const terminalState = this.terminalController.getState();
    const viewportState = terminalState.viewport;
    const terminalMode = terminalState.mode;
    const shouldAutoWrap = terminalMode.autoWrap;

    for (const char of text) {
      // Handle backspace separately
      if (char === "\b") {
        if (this.state.x > 0) {
          this.state.x--;
        }
        continue;
      }

      switch (char) {
        case "\r":
          this.state.x = 0;
          break;

        case "\n":
          this.handleLineFeed();
          break;

        default:
          // Only increment x if we're not already at the edge
          if (this.state.x < viewportState.width) {
            this.state.x++;
          }

          // Handle auto-wrap behavior
          if (shouldAutoWrap && this.state.x >= viewportState.width) {
            this.state.x = 0;
            // Only trigger line feed if we're actually wrapping content
            // and not just hitting the edge with spaces
            if (char !== " ") {
              this.handleLineFeed();
            }
          }
      }
    }
  }

  private processC0Control(controlChar: ControlCharacter): void {
    switch (controlChar) {
      case ControlCharacter.BS:
        if (this.state.x > 0) {
          this.state.x--;
        }
        break;

      case ControlCharacter.HT:
        const viewportState = this.viewport.getState();
        const nextTab = this.state.x + (8 - (this.state.x % 8));
        if (nextTab >= viewportState.width) {
          this.state.x = 0;
          this.handleLineFeed();
        } else {
          this.state.x = nextTab;
        }
        break;

      case ControlCharacter.LF:
      case ControlCharacter.VT:
      case ControlCharacter.FF:
        this.handleLineFeed();
        break;

      case ControlCharacter.CR:
        this.state.x = 0;
        break;

      case ControlCharacter.NEL:
        this.handleLineFeed();
        this.state.x = 0;
        break;
    }
  }

  private processCursorCommand(sequence: CSISequence): void {
    const viewportState = this.viewport.getState();
    const finalByte = sequence.finalByte;
    const param = sequence.parameters[0]?.value ?? 1;
    const param2 = sequence.parameters[1]?.value ?? 1;

    switch (finalByte) {
      case 0x41: // 'A' - Cursor Up
        this.state.y = Math.max(0, this.state.y - param);
        break;

      case 0x42: // 'B' - Cursor Down
        this.state.y = Math.min(viewportState.height - 1, this.state.y + param);
        break;

      case 0x43: // 'C' - Cursor Forward
        this.state.x = Math.min(viewportState.width - 1, this.state.x + param);
        break;

      case 0x44: // 'D' - Cursor Back
        this.state.x = Math.max(0, this.state.x - param);
        break;

      case 0x45: // 'E' - Cursor Next Line
        this.state.y = Math.min(viewportState.height - 1, this.state.y + param);
        this.state.x = 0;
        break;

      case 0x46: // 'F' - Cursor Previous Line
        this.state.y = Math.max(0, this.state.y - param);
        this.state.x = 0;
        break;

      case 0x47: // 'G' - Cursor Horizontal Absolute
        this.state.x = Math.min(
          viewportState.width - 1,
          Math.max(0, param - 1)
        );
        break;

      case 0x48: // 'H' - Cursor Position
        this.state.y = Math.min(
          viewportState.height - 1,
          Math.max(0, param - 1)
        );
        this.state.x = Math.min(
          viewportState.width - 1,
          Math.max(0, param2 - 1)
        );
        break;

      case 0x73: // 's' - Save Cursor Position
        this.state.savedX = this.state.x;
        this.state.savedY = this.state.y;
        this.state.isSaved = true;
        break;

      case 0x75: // 'u' - Restore Cursor Position
        if (
          this.state.isSaved &&
          this.state.savedX !== undefined &&
          this.state.savedY !== undefined
        ) {
          this.state.x = Math.min(viewportState.width - 1, this.state.savedX);
          this.state.y = Math.min(viewportState.height - 1, this.state.savedY);
        }
        break;
    }
  }

  public enforceBounds(): void {
    const viewportState = this.viewport.getState();
    // Get effective maximum bounds (minimum of explicit bounds and viewport dimensions)
    const effectiveMaxX =
      this.maxX !== Infinity
        ? Math.min(this.maxX, viewportState.width - 1)
        : viewportState.width - 1;

    const effectiveMaxY =
      this.maxY !== Infinity
        ? Math.min(this.maxY, viewportState.height - 1)
        : viewportState.height - 1;

    // Handle horizontal wrap-around
    while (this.state.x > effectiveMaxX) {
      if (this.terminalController.getState().mode.autoWrap) {
        this.state.x -= effectiveMaxX + 1;
        this.state.y++;
      } else {
        this.state.x = effectiveMaxX;
        break;
      }
    }

    // Ensure cursor stays within bounds
    this.state.x = Math.max(0, Math.min(this.state.x, effectiveMaxX));
    this.state.y = Math.max(0, Math.min(this.state.y, effectiveMaxY));
  }

  // Reset cursor state to initial values
  public reset(): void {
    this.state = {
      x: 0,
      y: 0,
      isVisible: true,
      isSaved: false,
    };
  }

  // Set bounds for cursor movement (if needed)
  public setBounds(maxX: number, maxY: number): void {
    this.maxX = maxX;
    this.maxY = maxY;
    this.enforceBounds();
  }

  public setPosition(x: number, y: number): void {
    this.state.x = x;
    this.state.y = y;
    this.enforceBounds();
  }

  public async setup(controller: TerminalController) {
    const dsr = CSISequence.from(new Uint8Array([0x1b, 0x5b, 0x36, 0x6e])); // ESC [ 6 n
    const response = await controller.sendSequenceWithResponse(
      dsr,
      /\x1b\[(\d+);(\d+)R/
    );

    const y = parseInt(response[1], 10);
    const x = parseInt(response[2], 10);
    this.setPosition(x, y);
  }
}
