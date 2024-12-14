interface Position {
  x: number;
  y: number;
}

interface Dimensions {
  width: number;
  height: number;
}

export class PositionTranslator {
  private windowPosition: Position;
  private contentOffset: Position;

  constructor(windowPosition: Position) {
    this.windowPosition = windowPosition;
    // Content offset accounts for window borders
    this.contentOffset = {
      x: 1, // Left border
      y: 1, // Top border
    };
  }

  // Convert terminal absolute position to window-relative position
  public toRelative(position: Position): Position {
    return {
      x: position.x - this.windowPosition.x - this.contentOffset.x,
      y: position.y - this.windowPosition.y - this.contentOffset.y,
    };
  }

  // Convert window-relative position to terminal absolute position
  public toAbsolute(position: Position): Position {
    return {
      x: position.x + this.windowPosition.x + this.contentOffset.x,
      y: position.y + this.windowPosition.y + this.contentOffset.y,
    };
  }

  // Check if a position (in absolute coordinates) is within the window's content area
  public isWithinWindow(position: Position, dimensions: Dimensions): boolean {
    const relativePos = this.toRelative(position);
    return (
      relativePos.x >= 0 &&
      relativePos.x < dimensions.width &&
      relativePos.y >= 0 &&
      relativePos.y < dimensions.height
    );
  }

  // Update window position
  public setWindowPosition(position: Position): void {
    this.windowPosition = position;
  }
}
