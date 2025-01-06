import { TerminalComponent, ComponentProps } from "../TerminalComponent.js";
import { StyledTextContentManager } from "./StyledTextContentManager.js";
import { ContentStyle } from "../ContentManager.js";
import { Size } from "../index.js";
import { HierarchicalLogger } from "../HierarchicalLogger.js";

interface StyledTextComponentProps extends ComponentProps {
  text?: string;
  style?: Partial<ContentStyle>;
}

export class StyledTextComponent extends TerminalComponent {
  private textManager: StyledTextContentManager;
  private lastMeasurement?: { width: number; height: number; result: Size };

  constructor(props: StyledTextComponentProps = {}) {
    super(props);
    this.textManager = new StyledTextContentManager(
      props.text || "",
      props.style
    );
    this.setContentManager(this.textManager);

    this.setLayoutConstraints({
      minWidth: 1,
      minHeight: 1,
    });
  }

  protected synchronizeContent(): void {
    if (!this.contentManager) return;

    // Use actual dimensions for content synchronization
    this.contentManager.measure({ width: this.width, height: this.height });
    this.markDirty();
  }

  protected render(): void {
    // Ensure content is synchronized before render
    this.synchronizeContent();
    super.render();
  }

  protected measureContent(availableSpace?: Size): Size {
    if (this.contentManager) {
      return this.contentManager.measure({
        width: availableSpace?.width ?? this.width,
        height: availableSpace?.height ?? this.height,
      });
    }

    const stripTags = (text: string): string => {
      return text.replace(/<[^>]+>/g, "");
    };

    // Get the raw content (this should be a class property)
    const rawContent =
      "Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello";
    const pureText = stripTags(rawContent);
    const words = pureText.split(" ");

    // If no available space is provided or width is unlimited
    if (!availableSpace || !availableSpace.width) {
      return {
        width: pureText.length,
        height: 1,
      };
    }

    // Calculate wrapped text dimensions
    let currentLineLength = 0;
    let currentHeight = 1;
    let maxWidth = 0;

    for (const word of words) {
      // Add space between words except at the start of a line
      const wordLength = word.length + (currentLineLength > 0 ? 1 : 0);

      // Check if word fits on current line
      if (currentLineLength + wordLength <= availableSpace.width) {
        currentLineLength += wordLength;
      } else {
        // Word doesn't fit, start new line
        currentHeight++;
        currentLineLength = word.length;
      }

      // Keep track of the maximum width used
      maxWidth = Math.max(maxWidth, currentLineLength);
    }

    const measuredWidth = Math.min(maxWidth, availableSpace.width);
    const measuredHeight = currentHeight;

    HierarchicalLogger.log(
      `${this.componentId}.getContentSize(): ContentManager NOT FOUND`,
      {
        availableSpace,
        size: `${this.width}x${this.height}`,
        measured: `${measuredWidth}x${measuredHeight}`,
      }
    );

    return {
      width: measuredWidth,
      height: measuredHeight,
    };
  }

  public resize(width: number, height: number): void {
    const oldWidth = this.width;

    // Call parent resize
    super.resize(width, height);

    // Only synchronize if width changed (height changes don't affect text wrapping)
    if (oldWidth !== width) {
      this.synchronizeContent();
    }
  }

  protected handleAddChild(child: TerminalComponent): void {
    throw new Error("StyledTextComponent does not support child components");
  }

  protected handleRemoveChild(child: TerminalComponent): void {
    throw new Error("StyledTextComponent does not support child components");
  }

  public setText(text: string): void {
    this.textManager.setContent(text);
    this.synchronizeContent();
  }

  public getText(): string {
    return this.textManager.getContent();
  }

  public setStyle(style: Partial<ContentStyle>): void {
    this.textManager.setStyle(style);
    this.markDirty();
    this.requestLayout();
  }

  protected getDefaultCursorPosition() {
    return { x: 0, y: 0 };
  }

  protected isValidCursorPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  protected getContentOffset(): { x: number; y: number } {
    return { x: 0, y: 0 };
  }

  protected getContentDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
