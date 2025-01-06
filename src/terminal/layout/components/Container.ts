import { FlexContainer, FlexContainerProps } from "./FlexContainer.js";
import { TerminalBuffer, SGRColor } from "../TerminalBuffer.js";
import { Size, Position } from "../index.js";

export type BorderStyle = "none" | "single" | "double" | "rounded";

export interface TitleStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: SGRColor | { r: number; g: number; b: number } | number;
  backgroundColor?: SGRColor | { r: number; g: number; b: number } | number;
}

export interface ContainerProps extends FlexContainerProps {
  title?: string;
  titleStyle?: TitleStyle;
  borderStyle?: BorderStyle;
  margin?: number;
  padding?: number;
}

export class Container extends FlexContainer {
  protected title: string;
  protected borderStyle: BorderStyle;
  protected titleStyle: TitleStyle;
  protected margin: number;
  protected padding: number;
  protected contentBuffer: TerminalBuffer;

  constructor(props: ContainerProps = {}) {
    super(props);

    this.title = props.title ?? "";
    this.titleStyle = props.titleStyle ?? {};
    this.borderStyle = props.borderStyle ?? "single";
    this.margin = props.margin ?? 0;
    this.padding = props.padding ?? 0;

    this.contentBuffer = new TerminalBuffer(0, 0);
    this.updateContentArea();
  }

  protected layoutChildren(): void {
    const contentDimensions = this.getContentDimensions();

    // Store original layout constraints
    const originalConstraints = {
      minWidth: this.getMinWidth(),
      maxWidth: this.getMaxWidth(),
      minHeight: this.getMinHeight(),
      maxHeight: this.getMaxHeight(),
    };

    // Temporarily adjust layout constraints to account for borders and padding
    this.setLayoutConstraints({
      minWidth: contentDimensions.width,
      maxWidth: contentDimensions.width,
      minHeight: contentDimensions.height,
      maxHeight: contentDimensions.height,
    });

    // Call FlexContainer's layout logic
    super.layoutChildren();

    // Restore original layout constraints
    this.setLayoutConstraints(originalConstraints);

    // Adjust children positions to account for margins and borders
    const offset = this.getContentOffset();
    this.children.forEach((child) => {
      if (child.visible) {
        child.setPosition(child.x + offset.x, child.y + offset.y);
      }
    });
  }

  protected getContentOffset(): Position {
    const borderOffset = this.borderStyle === "none" ? 0 : 1;
    return {
      x: this.margin + borderOffset + this.padding,
      y: this.margin + borderOffset + this.padding,
    };
  }

  protected getContentDimensions(): Size {
    return {
      width: this.getContentWidth(),
      height: this.getContentHeight(),
    };
  }

  protected render(): void {
    // First call super to render the flex content
    super.render();

    // Then draw borders on top
    const availWidth = this.width - this.margin * 2;
    const availHeight = this.height - this.margin * 2;

    if (availWidth <= 0 || availHeight <= 0) return;

    if (this.borderStyle !== "none") {
      this.drawBorders(availWidth, availHeight);
    }
  }

  private drawBorders(availWidth: number, availHeight: number): void {
    const chars = this.getBorderChars();

    // Draw horizontal borders
    for (let x = 1; x < availWidth - 1; x++) {
      this.buffer.setCharacter(x + this.margin, this.margin, chars.h);
      this.buffer.setCharacter(
        x + this.margin,
        availHeight - 1 + this.margin,
        chars.h
      );
    }

    // Draw vertical borders
    for (let y = 1; y < availHeight - 1; y++) {
      this.buffer.setCharacter(this.margin, y + this.margin, chars.v);
      this.buffer.setCharacter(
        availWidth - 1 + this.margin,
        y + this.margin,
        chars.v
      );
    }

    // Draw corners
    this.buffer.setCharacter(this.margin, this.margin, chars.tl);
    this.buffer.setCharacter(
      availWidth - 1 + this.margin,
      this.margin,
      chars.tr
    );
    this.buffer.setCharacter(
      this.margin,
      availHeight - 1 + this.margin,
      chars.bl
    );
    this.buffer.setCharacter(
      availWidth - 1 + this.margin,
      availHeight - 1 + this.margin,
      chars.br
    );

    // Draw title if present
    if (this.title) {
      const titleStart = this.margin + 2;
      const maxTitleLength = availWidth - 4;
      const displayTitle =
        this.title.length > maxTitleLength
          ? this.title.substring(0, maxTitleLength - 3) + "..."
          : this.title;

      const titleAttributes = {
        ...(this.titleStyle.bold !== undefined && {
          bold: this.titleStyle.bold,
        }),
        ...(this.titleStyle.underline !== undefined && {
          underline: this.titleStyle.underline,
        }),
        ...(this.titleStyle.italic !== undefined && {
          italic: this.titleStyle.italic,
        }),
        ...(this.titleStyle.color !== undefined && {
          foregroundColor: this.titleStyle.color,
        }),
        ...(this.titleStyle.backgroundColor !== undefined && {
          backgroundColor: this.titleStyle.backgroundColor,
        }),
      };

      this.buffer.setCharactersWithAttributes(
        titleStart,
        this.margin,
        displayTitle,
        titleAttributes
      );

      const titleEnd = titleStart + displayTitle.length;
      this.buffer.setCharacter(titleEnd, this.margin, chars.h);
    }
  }

  private getBorderChars(): {
    h: string;
    v: string;
    tl: string;
    tr: string;
    bl: string;
    br: string;
  } {
    switch (this.borderStyle) {
      case "none":
        return { h: " ", v: " ", tl: " ", tr: " ", bl: " ", br: " " };
      case "double":
        return { h: "═", v: "║", tl: "╔", tr: "╗", bl: "╚", br: "╝" };
      case "rounded":
        return { h: "─", v: "│", tl: "╭", tr: "╮", bl: "╰", br: "╯" };
      case "single":
      default:
        return { h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘" };
    }
  }

  protected getContentWidth(): number {
    const borderSize = this.borderStyle === "none" ? 0 : 2;
    return Math.max(
      0,
      this.width - this.margin * 2 - borderSize - this.padding * 2
    );
  }

  protected getContentHeight(): number {
    const borderSize = this.borderStyle === "none" ? 0 : 2;
    return Math.max(
      0,
      this.height - this.margin * 2 - borderSize - this.padding * 2
    );
  }

  private updateContentArea(): void {
    const contentWidth = this.getContentWidth();
    const contentHeight = this.getContentHeight();

    if (
      contentWidth !== this.contentBuffer.width ||
      contentHeight !== this.contentBuffer.height
    ) {
      this.contentBuffer.resize(contentWidth, contentHeight);
      this.requestLayout();
    }
  }

  // Public setters
  public setTitle(title: string): void {
    if (this.title !== title) {
      this.title = title;
      this.requestLayout();
    }
  }

  public setBorderStyle(style: BorderStyle): void {
    if (this.borderStyle !== style) {
      this.borderStyle = style;
      this.requestLayout();
    }
  }

  public setMargin(margin: number): void {
    if (this.margin !== margin) {
      if (margin < 0) throw new Error("Margin must be non-negative");
      this.margin = margin;
      this.requestLayout();
    }
  }

  public setPadding(padding: number): void {
    if (this.padding !== padding) {
      if (padding < 0) throw new Error("Padding must be non-negative");
      this.padding = padding;
      this.requestLayout();
    }
  }

  public setTitleStyle(style: TitleStyle): void {
    this.titleStyle = { ...style };
    this.requestLayout();
  }

  protected onResize(): void {
    super.onResize?.();
    this.updateContentArea();
  }
}
