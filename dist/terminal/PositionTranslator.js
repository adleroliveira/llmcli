export class PositionTranslator {
    constructor(windowPosition) {
        this.windowPosition = windowPosition;
        // Content offset accounts for window borders
        this.contentOffset = {
            x: 1, // Left border
            y: 1, // Top border
        };
    }
    // Convert terminal absolute position to window-relative position
    toRelative(position) {
        return {
            x: position.x - this.windowPosition.x - this.contentOffset.x,
            y: position.y - this.windowPosition.y - this.contentOffset.y,
        };
    }
    // Convert window-relative position to terminal absolute position
    toAbsolute(position) {
        return {
            x: position.x + this.windowPosition.x + this.contentOffset.x,
            y: position.y + this.windowPosition.y + this.contentOffset.y,
        };
    }
    // Check if a position (in absolute coordinates) is within the window's content area
    isWithinWindow(position, dimensions) {
        const relativePos = this.toRelative(position);
        return (relativePos.x >= 0 &&
            relativePos.x < dimensions.width &&
            relativePos.y >= 0 &&
            relativePos.y < dimensions.height);
    }
    // Update window position
    setWindowPosition(position) {
        this.windowPosition = position;
    }
}
