import { TerminalComponent, ComponentProps } from "../TerminalComponent.js";
import { StyledTextContentManager } from "./StyledTextContentManager.js";
import { ContentStyle } from "../ContentManager.js";
import { Size } from "../index.js";

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
    this._flexGrow = 1;
    this.setContentManager(this.textManager);

    this.setLayoutConstraints({
      minWidth: 1,
      minHeight: 1,
    });
  }

  protected synchronizeContent(): void {
    if (!this.contentManager) return;

    // Use actual dimensions for content synchronization
    this.contentManager.measure(this.width || 1, this.height || 1);
    this.markDirty();
  }

  protected render(): void {
    // Ensure content is synchronized before render
    this.synchronizeContent();
    super.render();
  }

  protected measureContent(): Size {
    if (!this.contentManager) {
      return { width: 1, height: 1 };
    }

    // Use current dimensions for measurement if no constraints
    const measureWidth = (this._layoutConstraints.maxWidth ?? this.width) || 1;
    const measureHeight =
      (this._layoutConstraints.maxHeight ?? this.height) || 1;

    // Check cache with actual measurement values
    if (
      this.lastMeasurement &&
      this.lastMeasurement.width === measureWidth &&
      this.lastMeasurement.height === measureHeight
    ) {
      return this.lastMeasurement.result;
    }

    const measurement = this.contentManager.measure(
      measureWidth,
      measureHeight
    );

    // Cache results using actual measurement values
    this.lastMeasurement = {
      width: measureWidth,
      height: measureHeight,
      result: measurement,
    };

    return measurement;
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
