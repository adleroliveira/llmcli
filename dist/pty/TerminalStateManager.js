export class TerminalStateManager {
    constructor(rows = 24, cols = 80, trackBuffer = false) {
        this.state = {
            cursorPosition: { row: 0, col: 0 },
            activeStyles: {},
            activeModes: new Set(),
        };
        if (trackBuffer) {
            this.state.screenBuffer = Array.from({ length: rows }, () => Array(cols).fill(" "));
        }
    }
    getState() {
        return { ...this.state };
    }
    applyAction(action) {
        switch (action.type) {
            case "cursor":
                this.applyCursorAction(action);
                break;
            case "style":
                this.applyStyleAction(action);
                break;
            case "mode":
                this.applyModeAction(action);
                break;
            case "erase":
                this.applyEraseAction(action);
                break;
            case "data":
                this.applyDataAction(action);
                break;
        }
    }
    applyCursorAction(action) {
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
    applyStyleAction(action) {
        if (Object.keys(action.payload).length === 0) {
            // Reset styles if empty payload
            this.state.activeStyles = {};
        }
        else {
            this.state.activeStyles = {
                ...this.state.activeStyles,
                ...action.payload,
            };
        }
    }
    applyModeAction(action) {
        if (action.payload.enable) {
            this.state.activeModes.add(action.payload.mode);
        }
        else {
            this.state.activeModes.delete(action.payload.mode);
        }
    }
    applyEraseAction(action) {
        if (!this.state.screenBuffer)
            return;
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
        }
        else if (action.payload.target === "line") {
            // Implement line erasing logic
            const { row, col } = this.state.cursorPosition;
            this.eraseLine(row, action.payload.value);
        }
    }
    applyDataAction(action) {
        if (!this.state.screenBuffer)
            return;
        const { row, col } = this.state.cursorPosition;
        const content = action.payload.content;
        if (row < this.state.screenBuffer.length &&
            col < this.state.screenBuffer[0].length) {
            this.state.screenBuffer[row][col] = content;
            this.state.cursorPosition.col++;
        }
    }
    // Helper methods for erasing operations
    eraseScreenFromCursor(row, col) {
        if (!this.state.screenBuffer)
            return;
        // Implementation
    }
    eraseScreenToCursor(row, col) {
        if (!this.state.screenBuffer)
            return;
        // Implementation
    }
    eraseEntireScreen() {
        if (!this.state.screenBuffer)
            return;
        // Implementation
    }
    eraseLine(row, value) {
        if (!this.state.screenBuffer)
            return;
        // Implementation
    }
}
