# Understanding Clipping in TerminalComponent

## Overview

Clipping in TerminalComponent is a mechanism that restricts the rendering of a component and its children to a specific rectangular area. This is particularly useful for:

- Scrollable containers where content might overflow
- Modal dialogs that shouldn't render outside their bounds
- Drop-down menus that need to be contained within a specific area

## How Clipping Works

### Core Mechanism

The clipping system uses two main properties in TerminalComponent:

```typescript
protected _clipped: boolean = false;
protected _clipRect?: Rect;
```

When a component is clipped:

1. The component's buffer is clipped to the specified rectangle during composition
2. All children inherit the clipping bounds
3. Any content outside the clipping bounds is not rendered

### Implementation Details

The clipping is primarily implemented in the `composite` method:

```typescript
public composite(targetBuffer: TerminalBuffer): void {
  if (!this.visible) return;

  const pos = this.absolutePosition;

  if (this._clipped) {
    const clipRect = this._clipRect || {
      x: pos.x,
      y: pos.y,
      width: this.width,
      height: this.height,
    };

    const clippedBuffer = this.buffer.getClippedRegion(clipRect);
    targetBuffer.composite(clippedBuffer, pos);
  } else {
    targetBuffer.composite(this.buffer, pos);
  }

  // Children inherit clipping
  this.children.forEach((child) => {
    if (this._clipped) {
      child.setClipped(true, {
        x: pos.x,
        y: pos.y,
        width: this.width,
        height: this.height,
      });
    }
    child.composite(targetBuffer);
  });
}
```

## Example Implementations

### 1. Scrollable Container

Here's an example of a scrollable container that uses clipping to show only a portion of its content:

```typescript
class ScrollableContainer extends TerminalComponent {
  private scrollOffset: number = 0;

  constructor(props: ComponentProps) {
    super(props);
    // Enable clipping for this container
    this.setClipped(true);
  }

  protected addChild(child: TerminalComponent): void {
    this.addChildBase(child);
  }

  protected removeChild(child: TerminalComponent): void {
    this.removeChildBase(child);
  }

  public scroll(offset: number): void {
    this.scrollOffset = Math.max(0, offset);

    // Update viewport offset for all children
    this.children.forEach((child) => {
      child.setPosition(child.x, -this.scrollOffset);
    });

    this.markDirty();
  }

  protected render(): void {
    // Clear the buffer
    this.buffer.clear();

    // Optional: render scrollbar or indicators
    if (this.hasOverflow()) {
      this.renderScrollbar();
    }
  }

  private hasOverflow(): boolean {
    const totalHeight = this.children.reduce(
      (height, child) => Math.max(height, child.y + child.height),
      0
    );
    return totalHeight > this.height;
  }

  private renderScrollbar(): void {
    // Render a simple scrollbar on the right edge
    const barHeight = Math.max(
      1,
      Math.floor(this.height * (this.height / this.getTotalContentHeight()))
    );
    const barPosition = Math.floor(
      (this.scrollOffset / this.getTotalContentHeight()) * this.height
    );

    for (let y = 0; y < this.height; y++) {
      this.buffer.setCharacterWithAttributes(
        this.width - 1,
        y,
        y >= barPosition && y < barPosition + barHeight ? "█" : "│",
        { foreground: SGRColor.White }
      );
    }
  }

  private getTotalContentHeight(): number {
    return this.children.reduce(
      (height, child) => Math.max(height, child.y + child.height),
      0
    );
  }
}
```

### 2. Modal Dialog

Example of a modal dialog that uses clipping to ensure content stays within its borders:

```typescript
class ModalDialog extends TerminalComponent {
  private title: string;
  private content: TerminalComponent;

  constructor(props: ComponentProps & { title: string }) {
    super(props);
    this.title = props.title;

    // Enable clipping for the content area
    this.setClipped(true);

    // Create a specific clip rect for the content area (excluding borders)
    this._clipRect = {
      x: this.x + 1,
      y: this.y + 1,
      width: this.width - 2,
      height: this.height - 2,
    };
  }

  protected addChild(child: TerminalComponent): void {
    if (this.content) {
      throw new Error("Modal can only have one content component");
    }
    this.content = child;
    this.addChildBase(child);

    // Position child within the content area
    child.setPosition(1, 1);
  }

  protected removeChild(child: TerminalComponent): void {
    this.content = null;
    this.removeChildBase(child);
  }

  protected render(): void {
    this.buffer.clear();

    // Render border
    this.renderBorder();

    // Render title
    const centerX = Math.floor((this.width - this.title.length) / 2);
    this.buffer.setCharactersWithAttributes(centerX, 0, this.title, {
      bold: true,
    });
  }

  private renderBorder(): void {
    // Top and bottom borders
    for (let x = 0; x < this.width; x++) {
      this.buffer.setCharacterWithAttributes(x, 0, "─", {});
      this.buffer.setCharacterWithAttributes(x, this.height - 1, "─", {});
    }

    // Side borders
    for (let y = 0; y < this.height; y++) {
      this.buffer.setCharacterWithAttributes(0, y, "│", {});
      this.buffer.setCharacterWithAttributes(this.width - 1, y, "│", {});
    }

    // Corners
    this.buffer.setCharacterWithAttributes(0, 0, "┌", {});
    this.buffer.setCharacterWithAttributes(this.width - 1, 0, "┐", {});
    this.buffer.setCharacterWithAttributes(0, this.height - 1, "└", {});
    this.buffer.setCharacterWithAttributes(
      this.width - 1,
      this.height - 1,
      "┘",
      {}
    );
  }
}
```

### 3. Dropdown Menu

Example of a dropdown that uses clipping to handle overflow:

```typescript
class DropdownMenu extends TerminalComponent {
  private items: string[] = [];
  private isOpen: boolean = false;
  private selectedIndex: number = -1;

  constructor(props: ComponentProps & { items: string[] }) {
    super(props);
    this.items = props.items;
    this.setClipped(true);
    this.setFocusable(true);
  }

  protected addChild(child: TerminalComponent): void {
    throw new Error("DropdownMenu cannot have children");
  }

  protected removeChild(child: TerminalComponent): void {
    throw new Error("DropdownMenu cannot have children");
  }

  public toggle(): void {
    this.isOpen = !this.isOpen;

    // Adjust clipping based on open state
    if (this.isOpen) {
      this._clipRect = {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.items.length + 1, // +1 for the trigger
      };
    } else {
      this._clipRect = {
        x: this.x,
        y: this.y,
        width: this.width,
        height: 1, // Just the trigger when closed
      };
    }

    this.markDirty();
  }

  protected render(): void {
    this.buffer.clear();

    // Render trigger
    const triggerText =
      this.selectedIndex >= 0 ? this.items[this.selectedIndex] : "Select...";
    this.buffer.setCharactersWithAttributes(
      0,
      0,
      `${triggerText} ${this.isOpen ? "▲" : "▼"}`.padEnd(this.width),
      { inverse: this.focused }
    );

    // Render dropdown items if open
    if (this.isOpen) {
      this.items.forEach((item, index) => {
        this.buffer.setCharactersWithAttributes(
          0,
          index + 1,
          item.padEnd(this.width),
          { inverse: index === this.selectedIndex }
        );
      });
    }
  }
}
```

## Best Practices

1. **Clear Boundaries**: Always set clear clipping boundaries that match the component's logical content area.

2. **Performance**: Remember that clipping operations create new buffer instances, so use them judiciously.

3. **Hierarchy**: Consider the impact of clipping on child components and their positioning.

4. **Dynamic Updates**: Update clip rectangles when the component's size or position changes.

## Common Pitfalls

1. **Incorrect Clip Rect**: Ensure clip rectangles are calculated in absolute coordinates.

2. **Missing Updates**: Remember to update clip rectangles when component dimensions change.

3. **Efficiency**: Avoid unnecessary clipping for components that don't need it.

4. **Coordinate Systems**: Be careful with coordinate transformations when using clipping with scrolling or nested components.
