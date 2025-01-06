# Terminal UI Framework Content Management System Guide

## Overview

The Content Management System (CMS) in the Terminal UI Framework is designed to handle text content rendering, measurement, and styling within components. It's built around two main pieces:

1. The `ContentManager` abstract class that provides the core content handling functionality
2. The integration with `TerminalComponent` through the `contentManager` property

## Content Manager Architecture

### Core Concepts

The `ContentManager` class is responsible for:

- Content storage and manipulation
- Text measurement and layout calculations
- Text rendering to the component's buffer
- Style management
- Scroll position tracking

### Key Interfaces

```typescript
interface ContentMeasurement {
  width: number; // Required width for content
  height: number; // Required height for content
  wrappedContent: string[]; // Content split into lines
}

interface ContentStyle {
  wrap: boolean; // Enable/disable text wrapping
  alignment: "left" | "center" | "right"; // Text alignment
  padding?: {
    // Content padding
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  overflow: "hidden" | "scroll" | "ellipsis"; // Overflow behavior
}
```

### Abstract Methods

ContentManager requires implementing two key methods:

1. `measure(availableWidth: number, availableHeight: number): ContentMeasurement`

   - Calculates space requirements for content
   - Returns wrapped content and dimensions
   - Called during layout phase

2. `render(buffer: TerminalBuffer, measurement: ContentMeasurement): void`
   - Renders content to the component's buffer
   - Uses measurement data from previous measure call
   - Handles alignment and overflow

## Integration with TerminalComponent

### Content Manager Lifecycle

1. **Initialization**

   ```typescript
   component.setContentManager(new MyContentManager(initialContent, style));
   ```

2. **Layout Phase**

   - Component calls `measureContent()`
   - ContentManager's measure() calculates required space
   - Results influence component's preferred size

3. **Render Phase**
   - Component's `render()` method is called
   - ContentManager's render() writes to buffer
   - Component composites buffer to parent

### Key TerminalComponent Methods

```typescript
protected measureContent(): Size {
  if (!this.contentManager) {
    return {
      width: this._minWidth,
      height: this._minHeight,
    };
  }
  const measurement = this.contentManager.measure(this.width, this.height);
  return {
    width: measurement.width,
    height: measurement.height,
  };
}

protected render(): void {
  if (this.contentManager) {
    const measurement = this.contentManager.measure(this.width, this.height);
    this.contentManager.render(this.buffer, measurement);
  }
}
```

## Creating a Text Component

### Implementation Steps

1. **Create Custom Content Manager**

   ```typescript
   class TextContentManager extends ContentManager {
     measure(
       availableWidth: number,
       availableHeight: number
     ): ContentMeasurement {
       const wrappedLines = this.wrapText(this.content, availableWidth);
       return {
         width: Math.max(...wrappedLines.map((line) => line.length)),
         height: wrappedLines.length,
         wrappedContent: wrappedLines,
       };
     }

     render(buffer: TerminalBuffer, measurement: ContentMeasurement): void {
       const { wrappedContent } = measurement;
       const visibleContent =
         this.style.overflow === "scroll"
           ? wrappedContent.slice(this.scrollOffset)
           : wrappedContent;

       visibleContent.forEach((line, y) => {
         if (y >= buffer.height) return;
         const alignedLine = this.alignText(line, buffer.width);
         buffer.writeString(0, y, alignedLine);
       });
     }
   }
   ```

2. **Create Text Component**

   ```typescript
   class TextComponent extends TerminalComponent {
     constructor(props: ComponentProps & { text: string }) {
       super(props);
       this.setContentManager(new TextContentManager(props.text));
     }

     protected addChild(): void {
       throw new Error("TextComponent cannot have children");
     }

     protected removeChild(): void {
       throw new Error("TextComponent cannot have children");
     }

     public setText(text: string): void {
       this.contentManager?.setContent(text);
       this.markDirty();
     }
   }
   ```

### Utility Features

The ContentManager base class provides several utility methods:

1. **Text Wrapping**

   ```typescript
   protected wrapText(text: string, maxWidth: number): string[]
   ```

   - Splits text into lines that fit width
   - Handles word wrapping
   - Preserves existing line breaks

2. **Text Alignment**

   ```typescript
   protected alignText(text: string, width: number): string
   ```

   - Handles left/center/right alignment
   - Adds appropriate padding

3. **Ellipsis Truncation**
   ```typescript
   protected truncateWithEllipsis(text: string, maxWidth: number): string
   ```
   - Truncates text with "..."
   - Used for overflow: "ellipsis"

## Best Practices

1. **Content Updates**

   - Always use `setContent()` to update content
   - Call `markDirty()` after content changes

2. **Style Management**

   - Use `setStyle()` for style updates
   - Consider content remeasurement needs

3. **Scrolling**

   - Implement scroll handlers if needed
   - Use `scroll()` method for offset management

4. **Performance**

   - Cache measurement results when possible
   - Only rewrap on content/width changes

5. **Error Handling**
   - Validate content before rendering
   - Handle edge cases (empty content, zero width)

## Common Patterns

1. **Dynamic Content**

   ```typescript
   component.contentManager?.setContent(newContent);
   component.markDirty();
   ```

2. **Style Updates**

   ```typescript
   component.contentManager?.setStyle({
     alignment: "center",
     wrap: true,
   });
   component.markDirty();
   ```

3. **Scroll Management**
   ```typescript
   component.contentManager?.scroll(1); // Scroll down
   component.markDirty();
   ```

Remember that the Content Management System is designed to be extensible. You can create specialized content managers for different types of content (rich text, tables, etc.) while maintaining consistent behavior through the common interface.
