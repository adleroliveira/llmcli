import {
  VT100Sequence,
  ControlCharacter,
  SequenceType,
  BaseSequence,
} from "./Command.js";
import { CSISequence } from "./CSISequence.js";
import { DebugLogger } from "../DebugLogger.js";

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

  private maxX: number = Infinity;
  private maxY: number = Infinity;

  // Get current cursor state
  public getState(): CursorState {
    return { ...this.state };
  }

  public processSequence(sequence: BaseSequence | VT100Sequence): void {
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
    for (const char of text) {
      switch (char) {
        case "\r":
          this.state.x = 0;
          break;
        case "\n":
          this.state.y++;
          break;
        default:
          this.state.x++;
          if (this.maxX !== Infinity && this.state.x > this.maxX) {
            this.state.x = 0;
            this.state.y++;
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
        const nextTab = this.state.x + (8 - (this.state.x % 8));
        if (this.maxX !== Infinity && nextTab > this.maxX) {
          this.state.x = 0;
          this.state.y++;
        } else {
          this.state.x = nextTab;
        }
        break;

      case ControlCharacter.LF:
      case ControlCharacter.VT:
      case ControlCharacter.FF:
        this.state.y++;
        break;

      case ControlCharacter.CR:
        this.state.x = 0;
        break;

      case ControlCharacter.NEL:
        this.state.y++;
        this.state.x = 0;
        break;
    }
  }

  private processCursorCommand(sequence: CSISequence): void {
    const finalByte = sequence.finalByte;
    const param = sequence.parameters[0]?.value ?? 1;
    const param2 = sequence.parameters[1]?.value ?? 1;

    switch (finalByte) {
      case 0x41: // 'A' - Cursor Up
        this.state.y = Math.max(0, this.state.y - param);
        break;

      case 0x42: // 'B' - Cursor Down
        this.state.y += param;
        break;

      case 0x43: // 'C' - Cursor Forward
        this.state.x += param;
        break;

      case 0x44: // 'D' - Cursor Back
        this.state.x = Math.max(0, this.state.x - param);
        break;

      case 0x45: // 'E' - Cursor Next Line
        this.state.y += param;
        this.state.x = 0;
        break;

      case 0x46: // 'F' - Cursor Previous Line
        this.state.y = Math.max(0, this.state.y - param);
        this.state.x = 0;
        break;

      case 0x47: // 'G' - Cursor Horizontal Absolute
        this.state.x = Math.max(0, param - 1);
        break;

      case 0x48: // 'H' - Cursor Position
        this.state.y = Math.max(0, param - 1);
        this.state.x = Math.max(0, param2 - 1);
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
          this.state.x = this.state.savedX;
          this.state.y = this.state.savedY;
        }
        break;
    }
  }

  private enforceBounds(): void {
    if (this.maxX !== Infinity) {
      // Handle horizontal wrap-around
      while (this.state.x > this.maxX) {
        this.state.x -= this.maxX + 1;
        this.state.y++;
      }
    }

    // Ensure cursor stays within bounds
    this.state.x = Math.max(0, this.state.x);
    if (this.maxX !== Infinity) {
      this.state.x = Math.min(this.state.x, this.maxX);
    }

    this.state.y = Math.max(0, this.state.y);
    if (this.maxY !== Infinity) {
      this.state.y = Math.min(this.state.y, this.maxY);
    }
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
}
