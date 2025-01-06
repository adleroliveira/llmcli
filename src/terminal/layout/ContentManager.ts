import { TerminalBuffer } from "./TerminalBuffer.js";
import { Size } from "./index.js";

export interface ContentSpan<AttributeType = any> {
  text: string;
  attributes?: AttributeType;
}

export interface ContentMeasurement<T = any> {
  width: number;
  height: number;
  wrappedContent: ContentSpan<T>[][]; // Array of lines, each line is array of spans
}

export interface ContentStyle {
  wrap: boolean;
  alignment: "left" | "center" | "right";
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  overflow: "hidden" | "scroll" | "ellipsis";
}

export abstract class ContentManager<AttributeType = any> {
  protected content: string = "";
  protected _style: ContentStyle = {
    wrap: true,
    alignment: "left",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    overflow: "hidden",
  };
  protected scrollOffset: number = 0;

  constructor(initialContent: string = "", style?: Partial<ContentStyle>) {
    this.content = initialContent;
    if (style) {
      this._style = { ...this._style, ...style };
    }
  }

  public measure(availableSize?: Size): ContentMeasurement<AttributeType> {
    return this.measureContent(availableSize);
  }

  protected abstract measureContent(
    availableSize?: Size
  ): ContentMeasurement<AttributeType>;

  protected abstract parseContent(
    content: string
  ): ContentSpan<AttributeType>[];

  public abstract render(buffer: TerminalBuffer): void;

  public get style(): ContentStyle {
    return this._style;
  }

  public getContent(): string {
    return this.content;
  }

  public setContent(content: string): void {
    this.content = content;
  }

  public setStyle(style: Partial<ContentStyle>): void {
    this._style = { ...this._style, ...style };
  }

  public scroll(delta: number): void {
    this.scrollOffset = Math.max(0, this.scrollOffset + delta);
  }

  protected wrapSpans(
    spans: ContentSpan<AttributeType>[],
    maxWidth: number
  ): ContentSpan<AttributeType>[][] {
    if (!this._style.wrap || maxWidth <= 0) {
      return spans.reduce<ContentSpan<AttributeType>[][]>((lines, span) => {
        const spanLines = span.text.split("\n");
        spanLines.forEach((line, i) => {
          if (i === 0 && lines.length > 0) {
            // Append to last line
            lines[lines.length - 1].push({
              text: line,
              attributes: span.attributes,
            });
          } else {
            // Start new line
            lines.push([
              {
                text: line,
                attributes: span.attributes,
              },
            ]);
          }
        });
        return lines;
      }, []);
    }

    const result: ContentSpan<AttributeType>[][] = [[]];
    let currentLine = result[0];
    let currentLineLength = 0;

    const pushSpan = (span: ContentSpan<AttributeType>) => {
      if (span.text.length > 0) {
        currentLine.push(span);
        currentLineLength += span.text.length;
      }
    };

    const startNewLine = () => {
      if (currentLine.length === 0) return; // Don't create empty lines
      currentLine = [];
      result.push(currentLine);
      currentLineLength = 0;
    };

    for (const span of spans) {
      // Handle explicit line breaks first
      const lines = span.text.split("\n");

      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) {
          startNewLine();
        }

        // Split into words and spaces, but keep both
        const words = line.split(/(\s+|\S+)/g).filter(Boolean);

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const isSpace = /^\s+$/.test(word);

          // Skip leading spaces at start of wrapped lines
          if (isSpace && currentLineLength === 0) continue;

          // If this word would exceed maxWidth
          if (currentLineLength + word.length > maxWidth) {
            // If we're not at the start of a line, wrap to next line
            if (currentLineLength > 0) {
              startNewLine();
              // If it was a space that caused the wrap, skip it
              if (isSpace) continue;
            }

            // Handle words longer than maxWidth
            if (!isSpace && word.length > maxWidth) {
              let remaining = word;
              while (remaining.length > 0) {
                const chunk = remaining.slice(0, maxWidth);
                pushSpan({
                  text: chunk,
                  attributes: span.attributes,
                });
                remaining = remaining.slice(maxWidth);
                if (remaining.length > 0) {
                  startNewLine();
                }
              }
              continue;
            }
          }

          // Add the word to the current line
          pushSpan({
            text: word,
            attributes: span.attributes,
          });
        }
      });
    }

    // Remove empty lines at the end
    while (result.length > 0 && result[result.length - 1].length === 0) {
      result.pop();
    }

    return result;
  }

  protected alignSpans(
    spans: ContentSpan<AttributeType>[],
    width: number
  ): ContentSpan<AttributeType>[] {
    if (this._style.alignment === "left") {
      return spans;
    }

    const lineLength = spans.reduce((len, span) => len + span.text.length, 0);
    const spaces = width - lineLength;
    if (spaces <= 0) return spans;

    const padding: ContentSpan<AttributeType> = {
      text: " ".repeat(
        this._style.alignment === "center" ? Math.floor(spaces / 2) : spaces
      ),
      attributes: undefined,
    };

    return [padding, ...spans];
  }
}
