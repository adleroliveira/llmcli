export type Position = {
  row: number;
  col: number;
};

export type TerminalStyle = {
  foreground?: number;
  background?: number;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  inverse?: boolean;
  hidden?: boolean;
  strikethrough?: boolean;
};

export type TerminalState = {
  cursorPosition: Position;
  savedCursorPosition?: Position;
  activeStyles: TerminalStyle;
  activeModes: Set<string>;
  screenBuffer?: string[][];
};

export type TerminalAction = {
  type: "cursor" | "style" | "mode" | "erase" | "data";
  payload: unknown;
};

export type CursorAction = TerminalAction & {
  type: "cursor";
  payload: {
    action: "move" | "save" | "restore";
    position?: Position;
  };
};

export type StyleAction = TerminalAction & {
  type: "style";
  payload: TerminalStyle;
};

export type ModeAction = TerminalAction & {
  type: "mode";
  payload: {
    mode: string;
    enable: boolean;
  };
};

export type EraseAction = TerminalAction & {
  type: "erase";
  payload: {
    target: "screen" | "line";
    value: number;
  };
};

export type DataAction = TerminalAction & {
  type: "data";
  payload: {
    content: string;
  };
};

export class TerminalStateManager {
  private state: TerminalState;

  constructor(
    rows: number = 24,
    cols: number = 80,
    trackBuffer: boolean = false
  ) {
    this.state = {
      cursorPosition: { row: 0, col: 0 },
      activeStyles: {},
      activeModes: new Set(),
    };

    if (trackBuffer) {
      this.state.screenBuffer = Array.from({ length: rows }, () =>
        Array(cols).fill(" ")
      );
    }
  }

  getState(): Readonly<TerminalState> {
    return { ...this.state };
  }

  applyAction(action: TerminalAction) {
    switch (action.type) {
      case "cursor":
        this.applyCursorAction(action as CursorAction);
        break;
      case "style":
        this.applyStyleAction(action as StyleAction);
        break;
      case "mode":
        this.applyModeAction(action as ModeAction);
        break;
      case "erase":
        this.applyEraseAction(action as EraseAction);
        break;
      case "data":
        this.applyDataAction(action as DataAction);
        break;
    }
  }

  private applyCursorAction(action: CursorAction) {
    switch (action.payload.action) {
      case "move":
        if (action.payload.position) {
          this.state.cursorPosition = { ...action.payload.position };
        }
        break;
      case "save":
        this.state.savedCursorPosition = { ...this.state.cursorPosition };
        break;
      case "restore":
        if (this.state.savedCursorPosition) {
          this.state.cursorPosition = { ...this.state.savedCursorPosition };
        }
        break;
    }
  }

  private applyStyleAction(action: StyleAction) {
    if (Object.keys(action.payload).length === 0) {
      // Reset styles if empty payload
      this.state.activeStyles = {};
    } else {
      this.state.activeStyles = {
        ...this.state.activeStyles,
        ...action.payload,
      };
    }
  }

  private applyModeAction(action: ModeAction) {
    if (action.payload.enable) {
      this.state.activeModes.add(action.payload.mode);
    } else {
      this.state.activeModes.delete(action.payload.mode);
    }
  }

  private applyEraseAction(action: EraseAction) {
    if (!this.state.screenBuffer) return;

    if (action.payload.target === "screen") {
      // Implement screen erasing logic
      const { row, col } = this.state.cursorPosition;
      switch (action.payload.value) {
        case 0: // Erase from cursor to end
          this.eraseScreenFromCursor(row, col);
          break;
        case 1: // Erase from start to cursor
          this.eraseScreenToCursor(row, col);
          break;
        case 2: // Erase entire screen
          this.eraseEntireScreen();
          break;
      }
    } else if (action.payload.target === "line") {
      // Implement line erasing logic
      const { row, col } = this.state.cursorPosition;
      this.eraseLine(row, action.payload.value);
    }
  }

  private applyDataAction(action: DataAction) {
    if (!this.state.screenBuffer) return;

    const { row, col } = this.state.cursorPosition;
    const content = action.payload.content;

    if (
      row < this.state.screenBuffer.length &&
      col < this.state.screenBuffer[0].length
    ) {
      this.state.screenBuffer[row][col] = content;
      this.state.cursorPosition.col++;
    }
  }

  // Helper methods for erasing operations
  private eraseScreenFromCursor(row: number, col: number) {
    if (!this.state.screenBuffer) return;
    // Implementation
  }

  private eraseScreenToCursor(row: number, col: number) {
    if (!this.state.screenBuffer) return;
    // Implementation
  }

  private eraseEntireScreen() {
    if (!this.state.screenBuffer) return;
    // Implementation
  }

  private eraseLine(row: number, value: number) {
    if (!this.state.screenBuffer) return;
    // Implementation
  }
}
