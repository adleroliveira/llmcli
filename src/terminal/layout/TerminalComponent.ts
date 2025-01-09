import { Position, Rect, Size } from "./index.js";
import { TerminalBuffer } from "./TerminalBuffer.js";
import { ContentManager } from "./ContentManager.js";
import { HierarchicalLogger } from "./HierarchicalLogger.js";
import { DebugLogger } from "../DebugLogger.js";

export enum UpdateSource {
  Direct = "direct",
  Resize = "resize",
  ContentChange = "content_change",
  LayoutRequest = "layout_request",
  ChildUpdate = "child_update",
  FocusChange = "focus_change",
  VisibilityChange = "visibility_change",
  PropertyChange = "property_change",
  Render = "render",
}

export class UpdateContext {
  private static instance: UpdateContext | null = null;
  private updateStack: { source: UpdateSource; component: string }[] = [];
  private traceActive: boolean = false;

  private constructor() {}

  static getInstance(): UpdateContext {
    if (!this.instance) {
      this.instance = new UpdateContext();
    }
    return this.instance;
  }

  startTrace(name: string) {
    HierarchicalLogger.startTrace(name);
    this.traceActive = true;
  }

  endTrace() {
    if (this.traceActive) {
      this.traceActive = false;
      HierarchicalLogger.endTrace();
    }
  }

  pushUpdate(source: UpdateSource, componentId: string) {
    this.updateStack.push({ source, component: componentId });

    if (this.updateStack.length === 1) {
      this.startTrace("Component Lifecycle");
      HierarchicalLogger.log(`Update chain started`, {
        source,
        component: componentId,
      });
    }
  }

  popUpdate() {
    const wasRootUpdate = this.updateStack.length === 1;
    this.updateStack.pop();

    if (wasRootUpdate) {
      HierarchicalLogger.log("Root update completing", {
        finalStackDepth: this.updateStack.length,
      });
      this.endTrace();
    }
  }

  getCurrentSource(): UpdateSource | null {
    return this.updateStack.length > 0
      ? this.updateStack[this.updateStack.length - 1].source
      : null;
  }

  getStackLength(): number {
    return this.updateStack.length;
  }
}

export interface ComponentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  visible?: boolean;
  minHeight?: number;
  minWidth?: number;
  maxHeight?: number;
  maxWidth?: number;
  flexGrow?: number;
  id?: string;
}

interface CursorState {
  x: number;
  y: number;
  visible: boolean;
}

let componentIdCounter = 0;

export type EventHandler<T = any> = (event: T) => void;

export interface Constraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export type Direction = "horizontal" | "vertical";

export abstract class TerminalComponent {
  public static activeLayoutChain: boolean = false;
  public static updateInProgress = false;

  private _x: number;
  private _y: number;
  private _width: number;
  protected _explicitWidth?: number;
  protected _explicitHeight?: number;
  private _height: number;
  private _zIndex: number = 0;
  private _visible: boolean;
  private _focusable: boolean = false;
  private _updateInProgress: boolean = false;
  private _needsLayout: boolean = false;
  private _childrenUpdated: boolean = false;
  private _contentOverflow = false;
  private _cursorVisible: boolean = false;
  private _activeFocus: boolean = false;
  private _hierarchicalFocus: boolean = false;
  private _lastCursorState: CursorState | null = null;
  private _cursorState: CursorState = {
    x: 0,
    y: 0,
    visible: false,
  };

  protected readonly componentId: string;
  protected buffer: TerminalBuffer;
  protected parent: TerminalComponent | null = null;
  protected children: TerminalComponent[] = [];
  protected eventHandlers: Map<string, Set<EventHandler>> = new Map();
  protected isDirty: boolean = true;
  protected contentManager?: ContentManager;
  protected _viewportOffset: Position = { x: 0, y: 0 };
  protected onCreate(): void {}
  protected onDestroy(): void {}
  protected onMount(): void {}
  protected onUnmount(): void {}
  protected onContentOverflow(): void {}
  protected onDirtyCallback?: () => void;
  protected onResizeCallback?: (size: Size) => void;
  protected _minWidth: number = 0;
  protected _minHeight: number = 0;
  protected _maxWidth: number = Infinity;
  protected _maxHeight: number = Infinity;
  protected _flexGrow: number = 0;
  protected _clipped: boolean = false;
  protected _clipRect?: Rect;
  protected _intrinsicSize: Size | null = null;
  protected _layoutConstraints: Constraints = {
    minWidth: 0,
    minHeight: 0,
    maxWidth: Infinity,
    maxHeight: Infinity,
  };

  constructor(props: ComponentProps = {}) {
    this.componentId = `${props.id || componentIdCounter++}::${
      this.constructor.name
    }`;
    this._x = props.x ?? 0;
    this._y = props.y ?? 0;
    this._width = props.width ?? 1;
    this._height = props.height ?? 1;
    this._explicitWidth = props.width;
    this._explicitHeight = props.height;
    this._minHeight = props.minHeight ?? 1;
    this._minWidth = props.minWidth ?? 1;
    this._maxHeight = props.maxHeight ?? Infinity;
    this._maxWidth = props.maxWidth ?? Infinity;
    this._flexGrow = props.flexGrow ?? 0;
    this._visible = props.visible ?? true;
    this.buffer = new TerminalBuffer(this._width, this._height);
  }

  private doRender() {
    const isRootComponent = this.componentId === "App_0";

    // For root component, log at root level
    if (isRootComponent) {
      HierarchicalLogger.log(`${this.componentId}.render()`, {
        hasContentManager: !!this.contentManager,
        bufferSize: `${this.buffer.width}x${this.buffer.height}`,
      });
    } else {
      // For non-root components, stay within the current group
      HierarchicalLogger.log(`${this.componentId}.render()`, {
        hasContentManager: !!this.contentManager,
        bufferSize: `${this.buffer.width}x${this.buffer.height}`,
      });
    }

    this.render();

    if (this.contentManager) {
      this.contentManager.render(this.buffer);
    }
  }

  protected render(): void {
    this.buffer.clear();
  }

  public requestUpdate(source: UpdateSource): void {
    const updateContext = UpdateContext.getInstance();
    updateContext.pushUpdate(source, this.componentId);

    try {
      this.update();
    } catch (error) {
      HierarchicalLogger.log(`Update failed for ${this.componentId}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        source,
      });
      throw error;
    } finally {
      updateContext.popUpdate();
    }
  }

  protected sortChildren(): void {
    this.children.sort((a, b) => a.zIndex - b.zIndex);
    this.markDirty();
  }

  protected getViewportAdjustedPosition(): Position {
    const pos = this.absolutePosition;
    return {
      x: pos.x - this._viewportOffset.x,
      y: pos.y - this._viewportOffset.y,
    };
  }

  protected getDefaultCursorPosition(): Position {
    return { x: 0, y: 0 };
  }

  private getContentSize(availableSize?: Size): Size {
    let measurement: Size;
    HierarchicalLogger.log(`${this.componentId}.getContentSize()`, {
      source: !!this.contentManager ? "contentManager" : "component",
      constraint: `${availableSize?.width}x${availableSize?.height}`,
      currentSize: `${this.width}x${this.height}`,
    });
    HierarchicalLogger.startGroup();
    if (!this.contentManager) {
      measurement = this.measureContent(availableSize);
    } else {
      measurement = this.contentManager.measure(availableSize);
    }
    HierarchicalLogger.log(`Result`, {
      measurement: `${measurement.width}x${measurement.height}`,
    });
    HierarchicalLogger.endGroup();
    return measurement;
  }

  protected measureContent(availableSize?: Size): Size {
    if (this.children.length === 0) {
      return {
        width: this._explicitWidth || this.width,
        height: this._explicitHeight || this.height,
      };
    }
    if (this.children.length === 1) {
      // TODO: Determine if explicit size (if it exists) should take precedence
      // over delegating to this.children[0].measureContent();
      return this.children[0].measureContent();
    }
    // TODO: implement a strategy to measure and combine children content size
    return {
      width: this.width,
      height: this.height,
    };
  }

  protected requestLayout(): void {
    this.invalidateLayout();
    this.emit("layoutNeeded", {});
  }

  public invalidateLayout(): void {
    if (this._needsLayout) return;
    this._needsLayout = true;
    this.markDirty();
  }

  protected getContentOffset(): Position {
    return { x: 0, y: 0 };
  }

  protected updateChildrenConstraints(): void {
    this.children.forEach((child) => {
      // New constraints start with parent bounds
      const borderSpace = this.getBorderSpace();
      const newConstraints = {
        maxWidth: this.width - borderSpace,
        maxHeight: this.height - borderSpace,
        minWidth: 0,
        minHeight: 0,
      };

      // Preserve explicit width if set
      if (child._explicitWidth) {
        newConstraints.minWidth = child._explicitWidth;
        newConstraints.maxWidth = child._explicitWidth;
      }

      // Preserve explicit height if set
      if (child._explicitHeight) {
        newConstraints.minHeight = child._explicitHeight;
        newConstraints.maxHeight = child._explicitHeight;
      }

      // Preserve explicit minimum constraints
      if (child._minWidth !== undefined) {
        newConstraints.minWidth = Math.max(
          newConstraints.minWidth,
          child._minWidth
        );
      }
      if (child._minHeight !== undefined) {
        newConstraints.minHeight = Math.max(
          newConstraints.minHeight,
          child._minHeight
        );
      }

      if (
        newConstraints.minWidth != child._layoutConstraints.minWidth ||
        newConstraints.minHeight != child._layoutConstraints.minHeight ||
        newConstraints.maxWidth != child._layoutConstraints.maxWidth ||
        newConstraints.maxHeight != child._layoutConstraints.maxHeight
      ) {
        HierarchicalLogger.log(
          `${this.componentId}.updateChildrenConstraints()`,
          {
            childId: child.getComponentId(),
            oldConstraints: stringifyConstraints(child._layoutConstraints),
            newConstraints: stringifyConstraints(newConstraints),
          }
        );

        // Apply new constraints
        HierarchicalLogger.startGroup();
        child.setLayoutConstraints(newConstraints);
        HierarchicalLogger.endGroup();
      } else {
        HierarchicalLogger.log("Skipping updateChildrenConstraints");
      }
    });
  }

  protected layoutChildren(): void {
    this.children.forEach((child) => {
      child.performLayout();
    });
  }

  protected getContentDimensions(): Size {
    const offset = this.getContentOffset();
    return {
      width: this.width - offset.x,
      height: this.height - offset.y,
    };
  }

  protected performLayout(): void {
    HierarchicalLogger.log(`${this.componentId}.performLayout()`, {
      currentSize: `${this.width}x${this.height}`,
      constraints: stringifyConstraints(this._layoutConstraints),
      flexGrow: this._flexGrow,
    });
    HierarchicalLogger.startGroup();

    const isRootLayout = !TerminalComponent.activeLayoutChain;
    if (isRootLayout) {
      TerminalComponent.activeLayoutChain = true;
    }

    if (!this._needsLayout && !TerminalComponent.updateInProgress) {
      HierarchicalLogger.log("Layout skipped", "not needed");
      HierarchicalLogger.endGroup();
      return;
    }

    // Phase 1: Measure
    const finalSize = this.resolveSize();

    if (!this.isSizeWithinConstraints(finalSize)) {
      throw new Error("Final Size violates constraints");
    }

    this.applySize(finalSize);
    this.updateChildrenConstraints();

    if (this.children.length > 0) {
      HierarchicalLogger.log(`${this.componentId}.layoutChildren()`, {
        childCount: this.children.length,
      });

      HierarchicalLogger.startGroup();
      this.layoutChildren();
      HierarchicalLogger.endGroup();
    }

    this._needsLayout = false;
    this.markDirty();

    if (isRootLayout) {
      TerminalComponent.activeLayoutChain = false;
    }

    HierarchicalLogger.endGroup();
  }

  protected resolveSize(size?: Size): Size {
    // Calculate effective constraints first
    const effectiveMinWidth = this.getMinWidth();

    const effectiveMaxWidth = Math.min(
      isFinite(this._maxWidth) ? this._maxWidth : Number.MAX_SAFE_INTEGER,
      isFinite(this._layoutConstraints.maxWidth)
        ? this._layoutConstraints.maxWidth
        : Number.MAX_SAFE_INTEGER
    );

    const effectiveMinHeight = this.getMinHeight();

    const effectiveMaxHeight = Math.min(
      isFinite(this._maxHeight) ? this._maxHeight : Number.MAX_SAFE_INTEGER,
      isFinite(this._layoutConstraints.maxHeight)
        ? this._layoutConstraints.maxHeight
        : Number.MAX_SAFE_INTEGER
    );

    const { width: preferredWidth, height: preferredHeight } =
      this.getPreferredSize({
        width: effectiveMaxWidth,
        height: effectiveMaxHeight,
      });

    const newWidth = size?.width || preferredWidth;
    const newHeight = size?.height || preferredHeight;

    // Determine width: try new size, then explicit size, then preferred size
    let width: number;
    if (newWidth !== undefined) {
      width = Math.max(
        effectiveMinWidth,
        Math.min(effectiveMaxWidth, newWidth)
      );
    } else if (this._explicitWidth !== undefined) {
      width = Math.max(
        effectiveMinWidth,
        Math.min(effectiveMaxWidth, this._explicitWidth)
      );
    } else {
      width = Math.max(
        effectiveMinWidth,
        Math.min(effectiveMaxWidth, preferredWidth)
      );
    }

    // Similar logging for height...
    let height: number;
    if (newHeight !== undefined) {
      height = Math.max(
        effectiveMinHeight,
        Math.min(effectiveMaxHeight, newHeight)
      );
    } else if (this._explicitHeight !== undefined) {
      height = Math.max(
        effectiveMinHeight,
        Math.min(effectiveMaxHeight, this._explicitHeight)
      );
    } else {
      height = Math.max(
        effectiveMinHeight,
        Math.min(effectiveMaxHeight, preferredHeight)
      );
    }

    if (this.width != width || this.height != height) {
      HierarchicalLogger.log(`${this.componentId}.resolveSize()`, {
        size: `${newWidth}x${newHeight}`,
        preferred: `${preferredWidth}x${preferredHeight}`,
        explicit: `${this._explicitWidth}x${this._explicitHeight}`,
        finalSize: `${width}x${height}`,
      });
    }
    return { width, height };
  }

  protected applySize(size: Size): void {
    const { width, height } = size;
    if (!this.isSizeWithinConstraints(size)) {
      throw new Error("Size violates constraints");
    }

    if (this.width !== width || this.height !== height) {
      this.setDimensions(width, height);
    }

    this.requestLayout();
  }

  protected addChildBase(child: TerminalComponent): void {
    HierarchicalLogger.startTrace("Add Child");
    HierarchicalLogger.log(`${this.componentId}.addChild()`, {
      child: child.componentId,
      currentChildren: this.children.length,
      childConstraints: stringifyConstraints(child.getLayoutConstraints()),
      parentConstraints: stringifyConstraints(this._layoutConstraints),
    });
    HierarchicalLogger.startGroup();

    if (child.parent) {
      HierarchicalLogger.log("Removing child from previous parent", {
        previousParent: child.parent.componentId,
      });
      child.parent.removeChild(child);
    }

    // Set parent first so child can access parent dimensions
    this.children.push(child);
    child.parent = this;

    // Request layout since we added a new child
    this.requestLayout();
    this.markDirty();

    HierarchicalLogger.endGroup();
    HierarchicalLogger.endTrace();
  }

  protected removeChildBase(child: TerminalComponent): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
      child.onUnmount();
      this.requestLayout();
      this.markDirty();
    }
  }

  protected isValidCursorPosition(x: number, y: number): boolean {
    const offset = this.getContentOffset();
    const contentDims = this.getContentDimensions();

    return (
      x >= offset.x &&
      x < offset.x + contentDims.width &&
      y >= offset.y &&
      y < offset.y + contentDims.height
    );
  }

  public getBorderSpace(): number {
    return 0; // Default implementation returns 0
  }

  public addChild(child: TerminalComponent): void {
    this.handleAddChild(child);
  }

  protected handleAddChild(child: TerminalComponent): void {
    this.addChildBase(child);
  }

  public removeChild(child: TerminalComponent): void {
    this.handleRemoveChild(child);
  }

  protected handleRemoveChild(child: TerminalComponent): void {
    this.removeChildBase(child);
  }

  public get x(): number {
    return this._x;
  }

  public get y(): number {
    return this._y;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public getComponentId(): string {
    return this.componentId;
  }

  public get visible(): boolean {
    return this._visible;
  }

  public get zIndex(): number {
    return this._zIndex;
  }

  public get size(): Size {
    return {
      width: this._width,
      height: this._height,
    };
  }

  public get focused(): boolean {
    return this._activeFocus || this._hierarchicalFocus;
  }

  public get hasActiveFocus(): boolean {
    return this._activeFocus;
  }

  public get inFocusChain(): boolean {
    return this._hierarchicalFocus;
  }

  public get hierarchicalFocus(): boolean {
    return this._hierarchicalFocus;
  }

  public get focusable(): boolean {
    return this._focusable;
  }

  public get dirty(): boolean {
    return this.isDirty;
  }

  public get activeFocus(): boolean {
    return this._activeFocus;
  }

  public get needsLayout(): boolean {
    return this._needsLayout;
  }

  public getParent(): TerminalComponent | null {
    return this.parent;
  }

  public getPosition(): Position {
    return { x: this._x, y: this._y };
  }

  public getFlexGrow(): number {
    return this._flexGrow;
  }

  // TODO: Fix this to also consider _minWidth and _minHeight (explicit constraints)
  public getMinWidth(): number {
    return Math.max(this._layoutConstraints.minWidth, this._minWidth);
  }

  public getStrictMinWidth(): number {
    return this._minWidth;
  }

  public getMinHeight(): number {
    return Math.max(this._layoutConstraints.minHeight, this._minHeight);
  }

  public getStrictMinHeight(): number {
    return this._minHeight;
  }

  public getMaxWidth(): number {
    return Math.min(this._layoutConstraints.maxWidth, this._maxWidth);
  }

  public getMaxHeight(): number {
    return Math.min(this._layoutConstraints.maxHeight, this._maxHeight);
  }

  public getMaxSize(): Size {
    return {
      width: this._layoutConstraints.maxWidth,
      height: this._layoutConstraints.maxHeight,
    };
  }

  public getCurrentSize(): Size {
    return {
      width: this.width,
      height: this.height,
    };
  }

  public getLayoutConstraints(): Constraints {
    return this._layoutConstraints;
  }

  protected onResize(size: Size): void {
    if (this.onResizeCallback) {
      this.onResizeCallback(size);
    }
  }

  protected resizeIfNeeded() {
    // if (this.isSizeWithinConstraints()) {
    //   HierarchicalLogger.log("Size within constraints, skipping resize", {
    //     size: `${this.width}x${this.height}`,
    //     constraints: stringifyConstraints(this._layoutConstraints),
    //   });
    //   return;
    // }

    // Instead of getting preferred size, just adjust current size to fit constraints
    const newWidth = Math.min(
      Math.max(this.width, this._layoutConstraints.minWidth),
      this._layoutConstraints.maxWidth
    );
    const newHeight = Math.min(
      Math.max(this.height, this._layoutConstraints.minHeight),
      this._layoutConstraints.maxHeight
    );

    if (newWidth !== this.width || newHeight !== this.height) {
      this.resize(newWidth, newHeight);
    }
  }

  protected isSizeWithinConstraints(size?: Size): boolean {
    const { width, height } = size ?? this.size;
    return (
      width >= this.getMinWidth() &&
      width <= this.getMaxWidth() &&
      height >= this.getMinHeight() &&
      height <= this.getMaxHeight()
    );
  }

  public getCursorPosition(): Position {
    if (!this._activeFocus || !this._cursorVisible) {
      return { x: -1, y: -1 };
    }

    const absolutePos = this.absolutePosition;
    return {
      x: absolutePos.x + this._cursorState.x,
      y: absolutePos.y + this._cursorState.y,
    };
  }

  public get absolutePosition(): Position {
    const parentPos = this.parent?.absolutePosition ?? { x: 0, y: 0 };
    return {
      x: parentPos.x + this._x,
      y: parentPos.y + this._y,
    };
  }

  public getCursorVisibility(): boolean {
    return this._cursorVisible && this._activeFocus;
  }

  public resize(newWidth: number, newHeight: number): void {
    const updateContext = UpdateContext.getInstance();
    updateContext.startTrace("Component Lifecycle");

    HierarchicalLogger.log(`${this.componentId}.resize()`, {
      from: `${this._width}x${this._height}`,
      to: `${newWidth}x${newHeight}`,
    });
    HierarchicalLogger.startGroup();

    const { width, height } = this.resolveSize({
      width: newWidth,
      height: newHeight,
    });

    if (this._width == width && this._height == height) {
      HierarchicalLogger.log("Resize skipped - dimensions unchanged");
      HierarchicalLogger.endGroup();
      return;
    }

    this.setDimensions(width, height);
    this.markDirty();
    this.requestLayout(); // Request layout before callbacks
    this.onResize({ width, height }); // Component's own callback
    this.parent?.onChildSizeChanged({ width, height }, this); // Parent notification last

    HierarchicalLogger.endGroup();
    HierarchicalLogger.endTrace();
  }

  public setCursorVisible(visible: boolean): void {
    if (this._cursorVisible !== visible) {
      this._cursorVisible = visible;
      if (this._activeFocus) {
        this.markDirty();
      }
    }
  }

  protected setContentManager(manager: ContentManager): void {
    this.contentManager = manager;
    this.markDirty();
  }

  public setPosition(x: number, y: number): void {
    if (this._x !== x || this._y !== y) {
      this._x = x;
      this._y = y;
      this.markDirty();
    }
  }

  public setVisible(visible: boolean): void {
    if (this._visible !== visible) {
      this._visible = visible;
      this.markDirty();
      this.requestUpdate(UpdateSource.VisibilityChange);
    }
  }

  public setZIndex(value: number): void {
    if (this._zIndex !== value) {
      this._zIndex = value;
      // Re-sort children in parent if exists
      if (this.parent) {
        this.parent.sortChildren();
      }
    }
  }

  public setHierarchicalFocus(value: boolean): void {
    this._hierarchicalFocus = value;
    this.markDirty();
  }

  public setFocusable(value: boolean): void {
    this._focusable = value;
  }

  public setClipped(value: boolean, rect?: Rect): void {
    this._clipped = value;
    this._clipRect = rect;
    this.markDirty();
  }

  protected setDimensions(width: number, height: number): void {
    if (this._width == width && this._height == height) return;

    HierarchicalLogger.log(`${this.componentId}.setDimensions()`, {
      from: `${this._width}x${this._height}`,
      to: `${width}x${height}`,
      reason: TerminalComponent.updateInProgress ? "update" : "external",
    });

    this._width = width;
    this._height = height;
    this.buffer.resize(width, height);
    this.markDirty();
  }

  public setSize(width: number, height: number): void {
    if (this._width !== width || this._height !== height) {
      this._explicitWidth = width;
      this._explicitHeight = height;
      this.resize(width, height);
    }
  }

  protected hasAnyFocusedChild(): boolean {
    return this.children.some(
      (child) => child._activeFocus || child._hierarchicalFocus
    );
  }

  protected setCursorPosition(x: number, y: number): void {
    const offset = this.getContentOffset();
    const contentDims = this.getContentDimensions();

    // Adjust for content offset and constrain to content area
    this._cursorState.x = Math.max(
      offset.x,
      Math.min(x, offset.x + contentDims.width - 1)
    );
    this._cursorState.y = Math.max(
      offset.y,
      Math.min(y, offset.y + contentDims.height - 1)
    );

    if (this._activeFocus && this._cursorVisible) {
      this.markDirty();
    }
  }

  public setMinDimensions(width: number, height: number): void {
    this._minWidth = width;
    this._minHeight = height;
    this.markDirty();
  }

  public setMaxDimensions(width: number, height: number): void {
    this._maxWidth = width;
    this._maxHeight = height;
    this.markDirty();
  }

  public setFlexGrow(value: number): void {
    this._flexGrow = value;
    this.markDirty();
  }

  public focus(): void {
    if (!this._focusable) return;

    // Unfocus siblings
    if (this.parent) {
      this.parent.children.forEach((child) => {
        if (child !== this) child.blur();
      });
    }

    this._activeFocus = true;

    // Restore last cursor position or use default
    if (this._lastCursorState) {
      this._cursorState = { ...this._lastCursorState };
    } else {
      const defaultPos = this.getDefaultCursorPosition();
      this.setCursorPosition(defaultPos.x, defaultPos.y);
    }

    // Set hierarchical focus up the tree
    let parent = this.parent;
    while (parent) {
      parent._hierarchicalFocus = true;
      parent.markDirty();
      parent = parent.parent;
    }

    this.emit("focus", { type: "active" });
    this.markDirty();
  }

  public blur(): void {
    if (this._activeFocus || this._hierarchicalFocus) {
      // Save current cursor state before blur
      if (this._activeFocus) {
        this._lastCursorState = { ...this._cursorState };
      }

      this._activeFocus = false;
      this._hierarchicalFocus = false;

      // Clear hierarchical focus up the tree if no focused children
      if (this.parent && !this.parent.hasAnyFocusedChild()) {
        this.parent.blur();
      }

      this.emit("blur", {});
      this.markDirty();
    }
  }

  public getFocusedCursorOwner(): TerminalComponent | null {
    if (this._activeFocus && this._cursorVisible) {
      return this;
    }

    for (const child of this.children) {
      const focusedChild = child.getFocusedCursorOwner();
      if (focusedChild) {
        return focusedChild;
      }
    }

    return null;
  }

  public getFocusableChildAt(x: number, y: number): TerminalComponent | null {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (
        child.visible &&
        child.focusable &&
        !child._activeFocus && // Don't return already focused components
        this.isPointInComponent(child, x, y)
      ) {
        return child;
      }
    }
    return null;
  }

  public getChildAt(x: number, y: number): TerminalComponent | null {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (child.visible && this.isPointInComponent(child, x, y)) {
        return child;
      }
    }
    return null;
  }

  public moveCursor(deltaX: number, deltaY: number): void {
    const newX = this._cursorState.x + deltaX;
    const newY = this._cursorState.y + deltaY;

    if (this.isValidCursorPosition(newX, newY)) {
      this.setCursorPosition(newX, newY);
    }
  }

  public addEventListener<T>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  public removeEventListener<T>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    this.eventHandlers.get(eventType)?.delete(handler);
  }

  protected emit<T>(eventType: string, event: T): void {
    this.eventHandlers.get(eventType)?.forEach((handler) => handler(event));
    // Bubble up events to parent
    if (this.parent) {
      this.parent.emit(eventType, event);
    }
  }

  public update(): void {
    const componentName = this.componentId;
    const updateContext = UpdateContext.getInstance();
    const updateSource = updateContext.getCurrentSource();

    if (!updateSource) {
      this.requestUpdate(UpdateSource.Direct);
      return;
    }

    const isRootUpdate = !TerminalComponent.updateInProgress;

    // Start component group
    HierarchicalLogger.startGroup(`${componentName}_update`);

    HierarchicalLogger.log(`${componentName}.update()`, {
      source: updateSource,
      type: isRootUpdate ? "root update" : undefined,
    });

    if (!this.visible || this._updateInProgress) {
      HierarchicalLogger.endGroup();
      return;
    }

    this._updateInProgress = true;

    try {
      if (isRootUpdate) {
        TerminalComponent.updateInProgress = true;
      }

      // Layout phase
      if (this._needsLayout || isRootUpdate) {
        this.performLayout();
      }

      // Update children
      if (!this._childrenUpdated && this.children.length > 0) {
        this._childrenUpdated = true;

        this.children.forEach((child) => {
          child.requestUpdate(UpdateSource.ChildUpdate);
        });
      }

      // Render
      if (this.isDirty) {
        this.doRender();
        this.isDirty = false;
      }
    } finally {
      this._updateInProgress = false;
      this._childrenUpdated = false;

      if (isRootUpdate) {
        TerminalComponent.updateInProgress = false;
        updateContext.endTrace();
      }

      HierarchicalLogger.endGroup();
    }
  }

  public setLayoutConstraints(constraints: Partial<Constraints>): void {
    const oldConstraints = { ...this._layoutConstraints };
    const changed = (Object.keys(constraints) as Array<keyof Constraints>).some(
      (key) => this._layoutConstraints[key] !== constraints[key]
    );

    if (changed) {
      this._layoutConstraints = {
        ...this._layoutConstraints,
        ...constraints,
      };

      HierarchicalLogger.log(`${this.componentId}.setLayoutConstraints()`, {
        oldConstraints: stringifyConstraints(oldConstraints),
        newConstraints: stringifyConstraints(this._layoutConstraints),
        reason: TerminalComponent.updateInProgress ? "update" : "external",
        source: UpdateContext.getInstance().getCurrentSource(),
      });

      HierarchicalLogger.log(`${this.componentId}.resizeIfNeeded()`);
      HierarchicalLogger.startGroup();
      this.resizeIfNeeded();
      HierarchicalLogger.endGroup();
    }
  }

  public getExplicitSize(): Partial<Size> {
    return {
      width: this._explicitWidth,
      height: this._explicitHeight,
    };
  }

  protected getAvailableSpace(): Size {
    return this.size;
  }

  protected onChildSizeChanged(newSize: Size, child: TerminalComponent): void {}

  public getPreferredSize(availableSpace?: Size): Size {
    HierarchicalLogger.log(`${this.componentId}.getPreferredSize()`, {
      availableSpace,
    });
    HierarchicalLogger.startGroup();

    const minWidth = this.getMinWidth();
    const maxWidth = this.getMaxWidth();
    const minHeight = this.getMinHeight();
    const maxHeight = this.getMaxHeight();
    if (
      minWidth == maxWidth &&
      minHeight == maxHeight &&
      minWidth <= (availableSpace?.width || Infinity) &&
      minHeight <= (availableSpace?.height || Infinity)
    ) {
      HierarchicalLogger.log(
        `Preferred Size (min=max): ${minWidth}x${minHeight}`
      );
      HierarchicalLogger.endGroup();
      return {
        width: minWidth,
        height: minHeight,
      };
    }
    if (this._explicitWidth && this._explicitHeight) {
      HierarchicalLogger.log(
        `Preferred Size (explicit): ${this._explicitWidth}x${this._explicitHeight}`
      );
      HierarchicalLogger.endGroup();
      return {
        width: this._explicitWidth,
        height: this._explicitHeight,
      };
    }
    const contentSize = this.getContentSize(availableSpace);
    const preferred = {
      width: this._explicitWidth ?? contentSize.width,
      height: this._explicitHeight ?? contentSize.height,
    };
    HierarchicalLogger.log(
      `Preferred Size (content): ${preferred.width}x${preferred.height}`
    );
    HierarchicalLogger.endGroup();
    return preferred;
  }

  public composite(targetBuffer: TerminalBuffer): void {
    if (!this.visible) return;

    const pos = this.absolutePosition;

    if (this._clipped) {
      const clipRect = this._clipRect || {
        x: pos.x,
        y: pos.y,
        width: this.width,
        height: this.height,
      };

      const clippedBuffer = this.buffer.getClippedRegion(clipRect);
      targetBuffer.composite(clippedBuffer, pos);
    } else {
      targetBuffer.composite(this.buffer, pos);
    }

    // Now this should work without type errors
    this.children.forEach((child) => {
      if (this._clipped) {
        child.setClipped(true, this._clipRect);
      }
      child.composite(targetBuffer);
    });
  }

  protected markDirty(): void {
    this.isDirty = true;
    if (this.parent) {
      this.parent.markDirty();
    }
  }

  protected isPointInComponent(
    component: TerminalComponent,
    x: number,
    y: number
  ): boolean {
    return (
      x >= component.x &&
      x < component.x + component.width &&
      y >= component.y &&
      y < component.y + component.height
    );
  }

  public getBoundingRect(): Rect {
    const pos = this.absolutePosition;
    return {
      x: pos.x,
      y: pos.y,
      width: this._width,
      height: this._height,
    };
  }

  public layout(): void {
    this.performLayout();
  }

  public destroy(): void {
    this.onDestroy();
    this.children.forEach((child) => child.destroy());
    this.children = [];
    this.eventHandlers.clear();
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  public getBuffer(): TerminalBuffer {
    return this.buffer;
  }

  public setOnDirtyCallback(callback: () => void) {
    this.onDirtyCallback = callback;
  }

  public setOnResizeCallback(callback: (size: Size) => void) {
    this.onResizeCallback = callback;
  }
}

export const stringifyConstraints = (constraints: Constraints): string => {
  return `Min(${constraints.minWidth}x${constraints.minHeight}) Max(${constraints.maxWidth}x${constraints.maxHeight})`;
};
