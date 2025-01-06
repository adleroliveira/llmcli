import {
  ContentManager,
  ContentMeasurement,
  ContentStyle,
  ContentSpan,
} from "../ContentManager.js";
import { TerminalBuffer, SGRColor } from "../TerminalBuffer.js";
import { Cell } from "../index.js";

type CellAttributes = Cell["attributes"];

export class StyledTextContentManager extends ContentManager<CellAttributes> {
  protected cachedMeasurement: ContentMeasurement<CellAttributes> | null = null;
  private parsedContent: {
    spans: ContentSpan<CellAttributes>[];
    plainText: string;
    naturalWidth: number;
    naturalHeight: number;
  };

  constructor(initialContent: string = "", style?: Partial<ContentStyle>) {
    super(initialContent, style);
    this.parsedContent =
      this.parseContentAndCalculateDimensions(initialContent);
  }

  private parseContentAndCalculateDimensions(content: string) {
    const spans = this.parseContent(content);
    const plainText = content.replace(/<[^>]+>/g, "");
    const lines = plainText.split("\n");

    return {
      spans,
      plainText,
      naturalWidth: Math.max(...lines.map((line) => line.length)),
      naturalHeight: lines.length,
    };
  }

  setContent(content: string): void {
    super.setContent(content);
    this.parsedContent = this.parseContentAndCalculateDimensions(content);
    this.cachedMeasurement = null; // Invalidate cached measurement
  }

  protected parseContent(text: string): ContentSpan<CellAttributes>[] {
    const spans: ContentSpan<CellAttributes>[] = [];
    let currentIndex = 0;
    const stack: CellAttributes[] = [{}];

    // Regular expression to match HTML-like tags
    const tagRegex = /<(\/?)(b|i|u|s|color|fg|bg)(?:\s+([^>]*))?>/g;

    let match;
    while ((match = tagRegex.exec(text)) !== null) {
      const [fullMatch, isClosing, tag, attributes] = match;

      // Add text before the tag
      if (currentIndex < match.index) {
        const textContent = text.slice(currentIndex, match.index);
        spans.push({
          text: textContent,
          attributes: { ...stack[stack.length - 1] },
        });
      }

      if (isClosing) {
        stack.pop();
      } else {
        const newAttributes = { ...stack[stack.length - 1] };

        switch (tag) {
          case "b":
            newAttributes.bold = true;
            break;
          case "i":
            newAttributes.italic = true;
            break;
          case "u":
            newAttributes.underline = true;
            break;
          case "s":
            newAttributes.strikethrough = true;
            break;
          case "color":
          case "fg":
            if (attributes) {
              const color = this.parseColor(attributes.trim(), false);
              if (color !== undefined) {
                newAttributes.foregroundColor = color;
              }
            }
            break;
          case "bg":
            if (attributes) {
              const color = this.parseColor(attributes.trim(), true);
              if (color !== undefined) {
                newAttributes.backgroundColor = color;
              }
            }
            break;
        }

        stack.push(newAttributes);
      }

      currentIndex = match.index + fullMatch.length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      spans.push({
        text: text.slice(currentIndex),
        attributes: { ...stack[stack.length - 1] },
      });
    }

    return spans;
  }

  measureContent(
    availableWidth: number,
    availableHeight: number
  ): ContentMeasurement<CellAttributes> {
    // Ensure we have valid, finite dimensions to work with
    const effectiveAvailableWidth = Number.isFinite(availableWidth)
      ? availableWidth
      : this.parsedContent.naturalWidth;
    const effectiveAvailableHeight = Number.isFinite(availableHeight)
      ? availableHeight
      : this.parsedContent.naturalHeight;

    const { padding } = this.style;
    const paddingH = (padding?.left || 0) + (padding?.right || 0);
    const paddingV = (padding?.top || 0) + (padding?.bottom || 0);

    // Ensure we have at least 1 character width to work with after padding
    const effectiveWidth = Math.max(1, effectiveAvailableWidth - paddingH);

    // Use base class wrapping for content
    const wrappedContent = this.wrapSpans(
      this.parsedContent.spans,
      effectiveWidth
    );

    // Calculate wrapped height based on number of wrapped lines
    const wrappedHeight = wrappedContent.length;

    // Calculate final dimensions, ensuring they are finite and positive
    const finalWidth = Math.max(
      1,
      Math.min(
        effectiveAvailableWidth,
        this.parsedContent.naturalWidth + paddingH
      )
    );

    const finalHeight = Math.max(
      1,
      Math.min(effectiveAvailableHeight, wrappedHeight + paddingV)
    );

    this.cachedMeasurement = {
      width: finalWidth,
      height: finalHeight,
      wrappedContent,
    };

    return this.cachedMeasurement;
  }

  render(buffer: TerminalBuffer): void {
    if (!this.cachedMeasurement) {
      // If we don't have a measurement yet, measure with buffer dimensions
      this.measure(buffer.width, buffer.height);
    }

    const measurement = this.cachedMeasurement!;
    const { padding } = this.style;
    const startY = padding?.top || 0;
    const startX = padding?.left || 0;

    measurement.wrappedContent.forEach((line, lineIndex) => {
      if (startY + lineIndex >= measurement.height) return;
      if (line.length === 0) return;

      // Apply alignment if needed
      const alignedLine = this.alignSpans(line, measurement.width - startX);

      let xOffset = startX;
      for (const span of alignedLine) {
        if (xOffset >= measurement.width) break;

        buffer.setCharactersWithAttributes(
          xOffset,
          startY + lineIndex,
          span.text,
          span.attributes || {}
        );
        xOffset += span.text.length;
      }
    });
  }

  private readonly fgColorMap: Record<string, SGRColor> = {
    black: SGRColor.Black,
    red: SGRColor.Red,
    green: SGRColor.Green,
    yellow: SGRColor.Yellow,
    blue: SGRColor.Blue,
    magenta: SGRColor.Magenta,
    cyan: SGRColor.Cyan,
    white: SGRColor.White,
    brightblack: SGRColor.BrightBlack,
    brightred: SGRColor.BrightRed,
    brightgreen: SGRColor.BrightGreen,
    brightyellow: SGRColor.BrightYellow,
    brightblue: SGRColor.BrightBlue,
    brightmagenta: SGRColor.BrightMagenta,
    brightcyan: SGRColor.BrightCyan,
    brightwhite: SGRColor.BrightWhite,
  };

  private readonly bgColorMap: Record<string, SGRColor> = {
    black: SGRColor.BgBlack,
    red: SGRColor.BgRed,
    green: SGRColor.BgGreen,
    yellow: SGRColor.BgYellow,
    blue: SGRColor.BgBlue,
    magenta: SGRColor.BgMagenta,
    cyan: SGRColor.BgCyan,
    white: SGRColor.BgWhite,
    brightblack: SGRColor.BgBrightBlack,
    brightred: SGRColor.BgBrightRed,
    brightgreen: SGRColor.BgBrightGreen,
    brightyellow: SGRColor.BgBrightYellow,
    brightblue: SGRColor.BgBrightBlue,
    brightmagenta: SGRColor.BgBrightMagenta,
    brightcyan: SGRColor.BgBrightCyan,
    brightwhite: SGRColor.BgBrightWhite,
  };

  private parseColor(
    colorAttr: string,
    isBackground: boolean = false
  ): SGRColor | { r: number; g: number; b: number } | undefined {
    // Use class-level color maps
    const colorMap = isBackground ? this.bgColorMap : this.fgColorMap;

    if (colorAttr in colorMap) {
      return colorMap[colorAttr];
    }

    // Handle RGB format
    const rgbMatch = colorAttr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
      };
    }

    return undefined;
  }
}
