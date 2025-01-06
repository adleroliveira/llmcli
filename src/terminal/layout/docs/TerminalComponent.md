# TerminalComponent Documentation

## Overview

TerminalComponent is an abstract base class that serves as the foundation for building terminal-based user interface components. It provides a comprehensive set of features for managing component lifecycle, layout, rendering, focus handling, and event management.

## Core Concepts

### Component Structure

- Each component has a position (x, y)
- Maintains its own dimensions (width, height)
- Contains a TerminalBuffer for rendering content
- Can have parent and child components (forming a component tree)
- Supports z-index based rendering order

### Layout System

The component implements a flexible layout system with:

- Minimum and maximum dimensions
- Preferred size calculation
- Flex grow support
- Content-based measurement
- Layout constraints

### Buffer Management

- Uses TerminalBuffer for internal rendering
- Supports composite operations for layered rendering
- Handles clipping and viewport management
- Manages dirty regions for efficient updates

## Lifecycle Methods

### Creation and Destruction

1. `constructor(props: ComponentProps)`

   - Initializes basic properties (position, dimensions, visibility)
   - Creates internal buffer

2. `onCreate()`

   - Called when component is created
   - Override for initialization logic

3. `onDestroy()`
   - Called before component destruction
   - Clean up resources

### Mounting

1. `onMount()`

   - Called when component is added to parent
   - Initialize state that requires parent context

2. `onUnmount()`
   - Called when removed from parent
   - Clean up parent-dependent resources

### Rendering

1. `render()`

   - Main rendering method
   - Override to implement custom rendering
   - Uses ContentManager if available

2. `update()`
   - Called on each frame
   - Handles layout and rendering updates
   - Propagates to children

### Layout

1. `onResize()`

   - Called when component dimensions change

2. `performLayout()`
   - Two-phase layout system:
     a. Measure phase: Calculate preferred size
     b. Layout phase: Position children

## Focus Management Handling

### Focus States

- `activeFocus`: Component has direct focus (cursor)
- `hierarchicalFocus`: Component is in focus chain
- `focusable`: Component can receive focus

### Focus Methods

- `focus()`: Activate focus on component
- `blur()`: Remove focus from component
- `getFocusedCursorOwner()`: Get currently focused component
- `getFocusableChildAt(x, y)`: Find focusable component at position

## Event System

### Event Handling

- Supports event registration and removal
- Events bubble up through component hierarchy
- Common events: focus, blur, resize

```typescript
// Event handling example
component.addEventListener("focus", (event) => {
  // Handle focus event
});
```

## Best Practices for Implementation

### Creating New Components

1. Extend TerminalComponent:

```typescript
export class CustomComponent extends TerminalComponent {
  protected addChild(child: TerminalComponent): void {
    this.addChildBase(child);
  }

  protected removeChild(child: TerminalComponent): void {
    this.removeChildBase(child);
  }

  protected render(): void {
    // Custom rendering logic
  }
}
```

2. Override necessary lifecycle methods
3. Implement custom rendering logic
4. Handle component-specific events

### Layout Management

1. Use layout constraints appropriately:

```typescript
component.setLayoutConstraints({
  minWidth: 10,
  minHeight: 5,
  flexGrow: 1,
});
```

2. Implement proper measurement:

```typescript
protected measureContent(): Size {
  // Return preferred size based on content
  return {
    width: calculatedWidth,
    height: calculatedHeight
  };
}
```

### Performance Optimization

1. Use `markDirty()` judiciously
2. Implement efficient rendering logic
3. Leverage clipping for large components
4. Minimize unnecessary layout passes

## Common Patterns

### Composite Components

```typescript
class CompositeComponent extends TerminalComponent {
  private header: HeaderComponent;
  private content: ContentComponent;

  constructor(props: ComponentProps) {
    super(props);
    this.header = new HeaderComponent();
    this.content = new ContentComponent();
    this.addChild(this.header);
    this.addChild(this.content);
  }
}
```

### Content Management

```typescript
class TextComponent extends TerminalComponent {
  constructor(props: ComponentProps) {
    super(props);
    this.setContentManager(new TextContentManager());
  }
}
```

### Focus Management

```typescript
class InputComponent extends TerminalComponent {
  constructor(props: ComponentProps) {
    super(props);
    this.setFocusable(true);
  }

  protected onFocus(): void {
    this.setCursorVisible(true);
  }
}
```

## Advanced Features

### Clipping

- Components can be clipped to their bounds
- Useful for scrollable containers
- Managed through `setClipped()` method

### Viewport Management

- Supports viewport offsetting
- Useful for implementing scrolling
- Managed through `_viewportOffset`

### Z-Index Management

- Controls rendering order of children
- Automatically sorts children based on z-index
- Modified through `setZIndex()`

## Error Handling and Debug Tips

1. Common Issues:

   - Improper layout constraints
   - Incorrect render order
   - Focus chain problems

2. Debugging Strategies:
   - Check component hierarchy
   - Verify layout constraints
   - Monitor dirty regions
   - Track focus chain

## Example Implementations

### Basic Container

```typescript
export class Container extends TerminalComponent {
  protected addChild(child: TerminalComponent): void {
    this.addChildBase(child);
  }

  protected removeChild(child: TerminalComponent): void {
    this.removeChildBase(child);
  }

  protected render(): void {
    // Optional: Add border or background
    this.buffer.clear();
  }
}
```

### Text Label

```typescript
export class Label extends TerminalComponent {
  private text: string = "";

  protected addChild(child: TerminalComponent): void {
    throw new Error("Label cannot have children");
  }

  protected removeChild(child: TerminalComponent): void {
    throw new Error("Label cannot have children");
  }

  protected render(): void {
    this.buffer.clear();
    this.buffer.setCharactersWithAttributes(0, 0, this.text, {});
  }

  public setText(text: string): void {
    this.text = text;
    this.markDirty();
  }
}
```

## Integration with TerminalBuffer

The TerminalBuffer class provides the actual rendering capabilities:

1. Cell Management

   - Each cell contains character and attributes
   - Supports colors, styles, and effects

2. Buffer Operations

   - Composite operations for layering
   - Clipping for bounded rendering
   - Dirty region tracking

3. Performance Considerations
   - Only update dirty regions
   - Efficient cell comparison
   - Optimized composite operations

## Future Considerations

1. Potential Enhancements:

   - Animation support
   - Touch/mouse input handling
   - Accessibility features
   - Theme management

2. Performance Optimizations:

   - Virtual scrolling
   - Batch updates
   - Memory pooling

3. Additional Features:
   - Drag and drop support
   - Rich text rendering
   - Custom effects
   - Component transitions
