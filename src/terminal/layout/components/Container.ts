import { FlexContainer, FlexContainerProps } from "./FlexContainer.js";
import { SGRColor } from "../TerminalBuffer.js";
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

  constructor(props: ContainerProps = {}) {
    super(props);

    this.title = props.title ?? "";
    this.titleStyle = props.titleStyle ?? {};
    this.borderStyle = props.borderStyle ?? "single";
    this.margin = props.margin ?? 0;
    this.padding = props.padding ?? 0;
  }

  public getBorderSpace() {
    const hasBorder = this.borderStyle !== "none";
    const borderWidth = hasBorder ? 2 : 0;
    return this.margin * 2 + borderWidth + this.padding * 2;
  }

  protected render(): void {
    // Clear buffer
    this.buffer.clear();

    // Render flex content
    super.render();

    // Draw borders if needed
    if (this.borderStyle !== "none") {
      const availWidth = this.width - this.margin * 2;
      const availHeight = this.height - this.margin * 2;

      if (availWidth > 0 && availHeight > 0) {
        this.drawBorders(availWidth, availHeight);
      }
    }
  }

  protected layoutChildren(): void {
    const borderSpace = this.getBorderSpace();

    // Layout children
    super.layoutChildren();

    // Adjust children positions for border and padding
    this.children.forEach((child) => {
      const position = child.getPosition();
      child.setPosition(
        position.x + borderSpace / 2,
        position.y + borderSpace / 2
      );
    });
  }

  protected measureContent(availableSpace: Size): Size {
    // Calculate exact space needed for borders
    const borderSpace = this.getBorderSpace();

    // Adjust available space for content measurement
    const contentAvailableSpace = {
      width: Math.max(0, availableSpace.width - borderSpace),
      height: Math.max(0, availableSpace.height - borderSpace),
    };

    // Measure actual content size needed
    const contentSize = super.measureContent(contentAvailableSpace);

    // Calculate final size - only add the necessary border space
    return {
      width: Math.min(availableSpace.width, contentSize.width + borderSpace),
      height: Math.min(availableSpace.height, contentSize.height + borderSpace),
    };
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
      // Skip the corners
      const leftX = this.margin;
      const rightX = availWidth - 1 + this.margin;
      const currentY = y + this.margin;

      this.buffer.setCharacter(leftX, currentY, chars.v);
      this.buffer.setCharacter(rightX, currentY, chars.v);
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
}
