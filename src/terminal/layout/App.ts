import { TerminalComponent } from "./TerminalComponent.js";
import {
  FlexContainer,
  FlexContainerProps,
} from "./components/FlexContainer.js";
import { Size } from "./index.js";
import { HierarchicalLogger } from "./HierarchicalLogger.js";

HierarchicalLogger.shouldLog = true;

export interface AppProps extends FlexContainerProps {
  title?: string;
  width: number;
  height: number;
}

export class App extends TerminalComponent {
  private title: string;
  private rootContainer: FlexContainer;

  constructor(props: AppProps) {
    super(props);
    this._flexGrow = 1;
    this.setLayoutConstraints({
      minWidth: props.width,
      minHeight: props.height,
      maxWidth: props.width,
      maxHeight: props.height,
    });
    this.title = props.title ?? "Terminal Application";
    this.rootContainer = new FlexContainer({
      ...props,
      width: props.width,
      height: props.height,
      flexGrow: 1,
      align: "stretch",
      id: "root-container",
    });
    this.rootContainer.setLayoutConstraints({
      minWidth: props.width,
      minHeight: props.height,
      maxWidth: props.width,
      maxHeight: props.height,
    });
    this.addChildBase(this.rootContainer);
    this.setFocusable(true);
    this.rootContainer.setFocusable(true);
    this.markDirty();
  }

  protected measureContent(): Size {
    return {
      width: this.width,
      height: this.height,
    };
  }

  protected override handleAddChild(child: TerminalComponent): void {
    this.rootContainer.addChild(child);
    this.markDirty();
  }

  protected override handleRemoveChild(child: TerminalComponent): void {
    this.rootContainer.removeChild(child);
    this.markDirty();
  }

  protected override markDirty(): void {
    if (!this.isDirty) {
      this.isDirty = true;
      // Only emit if we're not already in an update cycle
      if (!TerminalComponent.updateInProgress) {
        this.onDirtyCallback?.();
      }
    }
  }

  public override setSize(width: number, height: number): void {
    this._explicitWidth = width;
    this._explicitHeight = height;
    super.resize(width, height);
  }

  public override resize(width: number, height: number): void {
    this._minHeight = height;
    this._minWidth = width;
    this._maxHeight = height;
    this._maxWidth = width;
    this._layoutConstraints = {
      maxHeight: height,
      maxWidth: width,
      minHeight: height,
      minWidth: width,
    };
    this.setSize(width, height);
    this.rootContainer.setSize(width, height);
  }

  public setDefaultFocusedComponent(component: TerminalComponent): void {
    if (!component.focusable) {
      throw new Error("Component must be focusable to be set as default focus");
    }
    component.setCursorVisible(true);
    component.focus();
  }

  protected override render(): void {
    this.buffer.clear();

    // Let children handle their own state
    this.rootContainer.setClipped(true, {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    });

    // Children handle their own updates through the component lifecycle
    this.rootContainer.composite(this.buffer);
  }

  public setTitle(title: string): void {
    if (this.title !== title) {
      this.title = title;
      this.requestLayout();
    }
  }

  public getTitle(): string {
    return this.title;
  }

  public getAbsoluteCursorPosition(): { x: number; y: number } | null {
    const focusedComponent = this.getFocusedCursorOwner();
    if (!focusedComponent) {
      return null;
    }

    const cursorPos = focusedComponent.getCursorPosition();
    return cursorPos;
  }

  public override destroy(): void {
    this.onDirtyCallback = undefined;
    super.destroy();
  }
}
