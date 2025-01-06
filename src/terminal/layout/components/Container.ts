import { TerminalComponent, ComponentProps } from "../TerminalComponent.js";
import { TerminalBuffer, SGRColor } from "../TerminalBuffer.js";
import { Size, Position, Cell } from "../index.js";
import { DebugLogger } from "../../DebugLogger.js";

export type BorderStyle = "none" | "single" | "double" | "rounded";

export interface TitleStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: SGRColor | { r: number; g: number; b: number } | number;
  backgroundColor?: SGRColor | { r: number; g: number; b: number } | number;
}

export interface ContainerProps extends ComponentProps {
  title?: string;
  titleStyle?: TitleStyle;
  borderStyle?: BorderStyle;
  margin?: number;
  padding?: number;
}

export class Container extends TerminalComponent {
  protected title: string;
  protected borderStyle: BorderStyle;
  protected titleStyle: TitleStyle;
  protected margin: number;
  protected padding: number;
  protected contentBuffer: TerminalBuffer;

  constructor(props: ContainerProps = {}) {
    super(props);

    // If no explicit size, use parent's size
    if (!props.width && !props.height) {
      props.width = props.width ?? this.parent?.width ?? 1;
      props.height = props.height ?? this.parent?.height ?? 1;
    }

    this.title = props.title ?? "";
    this.titleStyle = props.titleStyle ?? {};
    this.borderStyle = props.borderStyle ?? "single";
    this.margin = props.margin ?? 0;
    this.padding = props.padding ?? 0;
    this._flexGrow = 1;

    // Default to filling available space
    this.setLayoutConstraints({
      minWidth: props.width ?? 1,
      minHeight: props.height ?? 1,
    });

    this.contentBuffer = new TerminalBuffer(0, 0);
    this.updateContentArea();
  }

  protected measureContent(): Size {
    const borderSize = this.borderStyle === "none" ? 0 : 2;
    const totalHorizontalSpace =
      this.margin * 2 + borderSize + this.padding * 2;
    const totalVerticalSpace = this.margin * 2 + borderSize + this.padding * 2;

    // Measure children
    let maxChildWidth = 0;
    let maxChildHeight = 0;

    this.children.forEach((child) => {
      if (!child.visible) return;
      const childSize = child.getPreferredSize();
      maxChildWidth = Math.max(maxChildWidth, childSize.width);
      maxChildHeight = Math.max(maxChildHeight, childSize.height);
    });

    return {
      width: maxChildWidth + totalHorizontalSpace,
      height: maxChildHeight + totalVerticalSpace,
    };
  }

  public getBorderSpace(): number {
    return this.borderStyle === "none" ? 0 : 2;
  }

  protected layoutChildren(): void {
    const contentWidth = this.getContentWidth();
    const contentHeight = this.getContentHeight();

    if (
      contentWidth !== this.contentBuffer.width ||
      contentHeight !== this.contentBuffer.height
    ) {
      this.contentBuffer.resize(contentWidth, contentHeight);
    }

    this.children.forEach((child) => {
      if (!child.visible) return;
      const borderOffset = this.borderStyle === "none" ? 0 : 1;
      child.setPosition(this.margin + borderOffset, this.margin + borderOffset);
      child.resize(contentWidth, contentHeight);
    });
  }

  protected getDefaultCursorPosition(): Position {
    const borderOffset = this.borderStyle === "none" ? 0 : 1;
    return {
      x: this.margin + borderOffset + this.padding,
      y: this.margin + borderOffset + this.padding,
    };
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

  protected isValidCursorPosition(x: number, y: number): boolean {
    const contentX = this.getContentX();
    const contentY = this.getContentY();
    const contentWidth = this.getContentWidth();
    const contentHeight = this.getContentHeight();

    const isInContent =
      x >= contentX &&
      x < contentX + contentWidth &&
      y >= contentY &&
      y < contentY + contentHeight;

    if (isInContent && this.children.length > 0) {
      const relativeX = x - contentX;
      const relativeY = y - contentY;

      return this.children.some(
        (child) =>
          child.visible &&
          relativeX >= child.x &&
          relativeX < child.x + child.width &&
          relativeY >= child.y &&
          relativeY < child.y + child.height
      );
    }

    return isInContent;
  }

  public focus(): void {
    if (!this.focusable) return;

    const focusableChild = this.children.find(
      (child) => child.focusable && child.visible
    );
    if (focusableChild) {
      focusableChild.focus();
      this.setHierarchicalFocus(true);
    } else {
      super.focus();
    }
  }

  public moveCursor(deltaX: number, deltaY: number): void {
    if (!this.activeFocus) return;

    const currentPos = this.getCursorPosition();
    const newX = currentPos.x + deltaX;
    const newY = currentPos.y + deltaY;

    if (this.isValidCursorPosition(newX, newY)) {
      this.setCursorPosition(newX, newY);
    } else {
      const contentX = this.getContentX();
      const contentY = this.getContentY();
      const contentWidth = this.getContentWidth();
      const contentHeight = this.getContentHeight();

      const clampedX = Math.max(
        contentX,
        Math.min(newX, contentX + contentWidth - 1)
      );
      const clampedY = Math.max(
        contentY,
        Math.min(newY, contentY + contentHeight - 1)
      );

      if (this.isValidCursorPosition(clampedX, clampedY)) {
        this.setCursorPosition(clampedX, clampedY);
      }
    }
  }

  protected render(): void {
    this.buffer.clear();

    const availWidth = this.width - this.margin * 2;
    const availHeight = this.height - this.margin * 2;

    if (availWidth <= 0 || availHeight <= 0) return;

    if (this.borderStyle !== "none") {
      this.drawBorders(availWidth, availHeight);
    }

    this.buffer.composite(
      this.contentBuffer,
      {
        x: this.getContentX(),
        y: this.getContentY(),
      },
      {
        x: this.getContentX(),
        y: this.getContentY(),
        width: this.getContentWidth(),
        height: this.getContentHeight(),
      }
    );
  }

  private drawBorders(availWidth: number, availHeight: number): void {
    const chars = this.getBorderChars();
    const innerWidth = availWidth - 2;

    for (let x = 1; x < availWidth - 1; x++) {
      this.buffer.setCharacter(x + this.margin, this.margin, chars.h);
      this.buffer.setCharacter(
        x + this.margin,
        availHeight - 1 + this.margin,
        chars.h
      );
    }

    for (let y = 1; y < availHeight - 1; y++) {
      this.buffer.setCharacter(this.margin, y + this.margin, chars.v);
      this.buffer.setCharacter(
        availWidth - 1 + this.margin,
        y + this.margin,
        chars.v
      );
    }

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

    if (this.title) {
      const titleStart = this.margin + 2;
      const maxTitleLength = availWidth - 4;
      const displayTitle =
        this.title.length > maxTitleLength
          ? this.title.substring(0, maxTitleLength - 3) + "..."
          : this.title;

      // DEBUG
      // displayTitle = `(contentW: ${this.getContentWidth()}, contentH: ${this.getContentHeight()})`;

      const titleAttributes: Cell["attributes"] = {
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

  protected getContentX(): number {
    return this.margin + (this.borderStyle === "none" ? 0 : 1) + this.padding;
  }

  protected getContentY(): number {
    return this.margin + (this.borderStyle === "none" ? 0 : 1) + this.padding;
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

  // Setters now trigger layout instead of just marking dirty
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

  public findNextFocusablePosition(
    currentX: number,
    currentY: number,
    direction: "up" | "down" | "left" | "right"
  ): Position | null {
    const contentX = this.getContentX();
    const contentY = this.getContentY();

    const relX = currentX - contentX;
    const relY = currentY - contentY;
    const nextChild = this.findNextFocusableChild(relX, relY, direction);

    if (nextChild) {
      return {
        x: contentX + nextChild.x,
        y: contentY + nextChild.y,
      };
    }

    return null;
  }

  private findNextFocusableChild(
    x: number,
    y: number,
    direction: "up" | "down" | "left" | "right"
  ): TerminalComponent | null {
    return (
      this.children.find((child) => {
        if (!child.visible || !child.focusable) return false;

        switch (direction) {
          case "up":
            return child.y < y;
          case "down":
            return child.y > y;
          case "left":
            return child.x < x;
          case "right":
            return child.x > x;
        }
      }) || null
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

  public setTitleStyle(style: TitleStyle): void {
    this.titleStyle = { ...style };
    this.requestLayout();
  }

  protected onResize(): void {
    super.onResize?.();
    this.updateContentArea();
  }
}
