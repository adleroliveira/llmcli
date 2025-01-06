# Understanding the Composite System in TerminalComponent

## Overview

The composite system is a crucial part of the TerminalComponent framework that handles how components are rendered together to form the final UI. It works by combining multiple TerminalBuffers in a hierarchical manner, respecting z-index ordering and clipping boundaries.

## Core Components

### 1. TerminalComponent Composite Method

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

  // Composite children in z-index order
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

### 2. TerminalBuffer Composite Method

```typescript
public composite(
  other: TerminalBuffer,
  position: Position,
  clip?: Rect
): void {
  if (
    position.x >= this._width ||
    position.y >= this._height ||
    position.x + other.width <= 0 ||
    position.y + other.height <= 0
  ) {
    return; // Early return if completely out of bounds
  }

  const startX = Math.max(0, position.x);
  const startY = Math.max(0, position.y);
  const endX = Math.min(this._width, position.x + other.width);
  const endY = Math.min(this._height, position.y + other.height);

  // Copy cells
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const sourceCell = other.getCell(x - position.x, y - position.y);
      if (sourceCell) {
        this.setCell(x, y, { ...sourceCell });
      }
    }
  }

  // Mark the composited region as dirty
  this.markDirty({
    x: startX,
    y: startY,
    width: endX - startX,
    height: endY - startY,
  });
}
```

## How Compositing Works

### 1. Component Tree Traversal

- Starting from the root component:
  1. Component renders its own content to its buffer
  2. Component's buffer is composited to the target buffer
  3. Children are composited in z-index order
  4. Process repeats recursively

### 2. Buffer Composition

- Each component's buffer is combined with the target buffer
- Composition respects:
  - Component position
  - Z-index ordering
  - Clipping boundaries
  - Visibility state

### 3. Cell Merging

When buffers are composited:

1. Source cells override target cells
2. Attributes are merged
3. Transparency is respected
4. Dirty regions are tracked

## Example Implementations

### 1. Layered Panel System

```typescript
class LayeredPanel extends TerminalComponent {
  private layers: Map<number, TerminalComponent> = new Map();

  protected addChild(child: TerminalComponent): void {
    this.addChildBase(child);
    this.layers.set(child.zIndex, child);
    this.sortChildren(); // Ensures correct z-index ordering
  }

  protected removeChild(child: TerminalComponent): void {
    this.layers.delete(child.zIndex);
    this.removeChildBase(child);
  }

  protected render(): void {
    this.buffer.clear();
    // Optional: render background or borders
  }

  public updateLayerIndex(child: TerminalComponent, newIndex: number): void {
    this.layers.delete(child.zIndex);
    child.setZIndex(newIndex);
    this.layers.set(newIndex, child);
    this.sortChildren();
  }
}
```

### 2. Overlay Component

```typescript
class Overlay extends TerminalComponent {
  constructor(props: ComponentProps) {
    super(props);
    this.setZIndex(1000); // Ensure overlay appears above other components
  }

  protected addChild(child: TerminalComponent): void {
    // Ensure child inherits high z-index
    child.setZIndex(child.zIndex + this.zIndex);
    this.addChildBase(child);
  }

  protected removeChild(child: TerminalComponent): void {
    this.removeChildBase(child);
  }

  protected render(): void {
    this.buffer.clear();

    // Optional: Add semi-transparent background
    this.buffer.fill(
      {
        x: 0,
        y: 0,
        width: this.width,
        height: this.height,
      },
      {
        char: " ",
        attributes: { backgroundColor: SGRColor.BgBlack },
        isDirty: true,
      }
    );
  }
}
```

### 3. Transparent Component

```typescript
class TransparentComponent extends TerminalComponent {
  protected render(): void {
    this.buffer.clear();

    // Make all cells transparent by default
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer.setCell(x, y, {
          char: " ",
          attributes: {},
          transparent: true,
          isDirty: true,
        });
      }
    }

    // Render actual content
    this.renderContent();
  }

  private renderContent(): void {
    // Only set non-transparent cells where needed
    // This allows underlying components to show through
  }
}
```

## Performance Optimizations

### 1. Dirty Region Tracking

```typescript
class OptimizedComponent extends TerminalComponent {
  private isDirtyRegion(region: Rect): boolean {
    return this.buffer
      .getDirtyRegions()
      .some(
        (dirty) =>
          region.x < dirty.x + dirty.width &&
          region.x + region.width > dirty.x &&
          region.y < dirty.y + dirty.height &&
          region.y + region.height > dirty.y
      );
  }

  protected render(): void {
    // Only render dirty regions
    const dirtyRegions = this.buffer.getDirtyRegions();
    dirtyRegions.forEach((region) => {
      this.renderRegion(region);
    });
  }

  private renderRegion(region: Rect): void {
    // Render only the specified region
  }
}
```

### 2. Batch Updates

```typescript
class BatchUpdateComponent extends TerminalComponent {
  private batchMode: boolean = false;
  private pendingUpdates: Set<Rect> = new Set();

  public startBatch(): void {
    this.batchMode = true;
  }

  public endBatch(): void {
    this.batchMode = false;
    this.processPendingUpdates();
  }

  protected markDirty(): void {
    if (this.batchMode) {
      // Collect updates
      this.pendingUpdates.add(this.getBoundingRect());
    } else {
      super.markDirty();
    }
  }

  private processPendingUpdates(): void {
    // Process all pending updates at once
    this.pendingUpdates.forEach((rect) => {
      this.buffer.markDirty(rect);
    });
    this.pendingUpdates.clear();
    super.markDirty();
  }
}
```

## Best Practices

1. **Z-Index Management**

   - Keep z-index ranges consistent across component types
   - Use relative z-indices within component groups
   - Document z-index ranges for different layer types

2. **Performance**

   - Minimize buffer size when possible
   - Use clipping for large components
   - Track and update only dirty regions
   - Batch updates when making multiple changes

3. **Component Hierarchy**

   - Keep the component tree shallow when possible
   - Group related components under common parents
   - Use z-index effectively for layering

4. **Buffer Management**
   - Clear buffers before rendering
   - Handle transparency correctly
   - Respect clipping boundaries
   - Update dirty regions appropriately

## Common Pitfalls

1. **Z-Index Conflicts**

   - Inconsistent z-index assignments
   - Not considering parent z-index
   - Forgetting to sort children after z-index changes

2. **Performance Issues**

   - Unnecessary buffer copying
   - Too frequent composite operations
   - Not using dirty region tracking
   - Inefficient clipping

3. **Coordinate Systems**

   - Mixing absolute and relative positions
   - Incorrect position calculations
   - Not accounting for parent offsets

4. **Memory Management**
   - Not cleaning up buffers
   - Creating unnecessary buffer copies
   - Memory leaks in component disposal
