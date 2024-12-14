import { CSISequence } from "./CSISequence.js";
export class ViewportStateManager {
    constructor(controller) {
        this.state = {
            width: 80, // Default terminal width
            height: 24, // Default terminal height
            scrollTop: 0,
            scrollBottom: 23, // Default to height - 1
        };
        this.terminalController = controller;
    }
    // Get current viewport state
    getState() {
        return { ...this.state };
    }
    processSequence(sequence) {
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
    handleSetScrollMargins(sequence) {
        // DECSTBM - Set Top and Bottom Margins
        const top = (sequence.parameters[0]?.value ?? 1) - 1;
        const bottom = (sequence.parameters[1]?.value ?? this.state.height) - 1;
        if (top < bottom && bottom < this.state.height) {
            this.state.scrollTop = top;
            this.state.scrollBottom = bottom;
        }
    }
    handleWindowManipulation(sequence) {
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
    enforceScrollBounds() {
        // Ensure scroll region is within viewport bounds
        this.state.scrollTop = Math.max(0, Math.min(this.state.scrollTop, this.state.height - 1));
        this.state.scrollBottom = Math.max(this.state.scrollTop, Math.min(this.state.scrollBottom, this.state.height - 1));
    }
    // Public methods for viewport manipulation
    resize(width, height) {
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
    setScrollRegion(top, bottom) {
        if (top < bottom && bottom < this.state.height) {
            this.state.scrollTop = top;
            this.state.scrollBottom = bottom;
            this.enforceScrollBounds();
        }
    }
    reset() {
        this.state = {
            width: this.state.width, // Preserve current dimensions
            height: this.state.height,
            scrollTop: 0,
            scrollBottom: this.state.height - 1,
        };
    }
    // Utility methods for scroll region calculations
    isWithinScrollRegion(line) {
        return line >= this.state.scrollTop && line <= this.state.scrollBottom;
    }
    getScrollRegionHeight() {
        return this.state.scrollBottom - this.state.scrollTop + 1;
    }
}
