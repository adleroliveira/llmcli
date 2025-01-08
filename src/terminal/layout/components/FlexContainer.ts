import { HierarchicalLogger } from "../HierarchicalLogger.js";
import { TerminalComponent, ComponentProps } from "../TerminalComponent.js";
import { Size } from "../index.js";

interface FlexDistributionResult {
  sizes: number[];
  remainingSpace: number;
}

export type FlexDirection = "row" | "column";
export type FlexAlign = "start" | "center" | "end" | "stretch";
export type FlexJustify =
  | "start"
  | "center"
  | "end"
  | "space-between"
  | "space-around";

export interface FlexContainerProps extends ComponentProps {
  direction?: FlexDirection;
  align?: FlexAlign;
  justify?: FlexJustify;
  gap?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  flexGrow?: number;
}

export class FlexContainer extends TerminalComponent {
  private direction: FlexDirection;
  private align: FlexAlign;
  private justify: FlexJustify;
  private gap: number;

  constructor(props: FlexContainerProps = {}) {
    super(props);

    // This will apply to the children
    this.direction = props.direction ?? "row";
    this.align = props.align ?? "start";
    this.justify = props.justify ?? "start";
    this.gap = props.gap ?? 1;

    // Set base layout constraints (for the FlexContainer it self)
    this.setLayoutConstraints({
      minWidth: props.minWidth ?? 1,
      minHeight: props.minHeight ?? 1,
      maxWidth: props.maxWidth ?? Infinity,
      maxHeight: props.maxHeight ?? Infinity,
    });
  }

  protected layoutChildren(): void {
    const isRow = this.direction === "row";
    const mainSize = (isRow ? this.width : this.height) - this.getBorderSpace();
    const crossSize =
      (isRow ? this.height : this.width) - this.getBorderSpace();
    const visibleChildren = this.children.filter((child) => child.visible);

    if (visibleChildren.length === 0) return;
    HierarchicalLogger.log(`${this.componentId}.calculateFlexDistribution()`, {
      direction: this.direction,
      mainSize,
      crossSize,
    });
    HierarchicalLogger.startGroup();
    const distribution = this.calculateFlexDistribution(mainSize);
    HierarchicalLogger.log(`Results`, {
      direction: this.direction,
      aligment: this.align,
      justify: this.justify,
      gap: this.gap,
      sizeDistribution: JSON.stringify(distribution),
    });
    HierarchicalLogger.endGroup();

    let mainPosition = 0;

    // Handle justify content
    if (this.justify !== "start" && distribution.remainingSpace > 0) {
      switch (this.justify) {
        case "center":
          mainPosition = Math.floor(distribution.remainingSpace / 2);
          break;
        case "end":
          mainPosition = distribution.remainingSpace;
          break;
        case "space-between":
          if (visibleChildren.length > 1) {
            this.gap = Math.floor(
              distribution.remainingSpace / (visibleChildren.length - 1)
            );
          }
          break;
        case "space-around":
          const spaceAround = Math.floor(
            distribution.remainingSpace / (visibleChildren.length * 2)
          );
          mainPosition = spaceAround;
          this.gap = spaceAround * 2;
          break;
      }
    }

    visibleChildren.forEach((child, index) => {
      const mainAxisSize = distribution.sizes[index];
      let crossAxisSize: number;
      let crossPosition = 0;

      // First, get the preferred size with the main axis constraint
      const availableSpace: Size = isRow
        ? { width: mainAxisSize, height: this.getMaxHeight() }
        : { width: this.getMaxWidth(), height: mainAxisSize };

      const preferredSize = child.getPreferredSize(availableSpace);

      // Determine cross-axis size based on alignment and preferred size
      if (this.align === "stretch") {
        crossAxisSize = crossSize;
      } else {
        crossAxisSize = isRow ? preferredSize.height : preferredSize.width;

        // Calculate cross-axis position based on alignment
        const availableCrossSpace = crossSize - crossAxisSize;
        switch (this.align) {
          case "center":
            crossPosition = Math.floor(availableCrossSpace / 2);
            break;
          case "end":
            crossPosition = availableCrossSpace;
            break;
          // "start" is default, crossPosition remains 0
        }
      }

      // Set the final size and position
      if (isRow) {
        child.setLayoutConstraints({
          minWidth: mainAxisSize,
          maxWidth: mainAxisSize,
          minHeight: this.align === "stretch" ? crossSize : 0,
          maxHeight: this.align === "stretch" ? crossSize : crossSize,
        });
        child.setPosition(mainPosition, crossPosition);
      } else {
        child.setLayoutConstraints({
          minWidth: this.align === "stretch" ? crossSize : 0,
          maxWidth: this.align === "stretch" ? crossSize : crossSize,
          minHeight: mainAxisSize,
          maxHeight: mainAxisSize,
        });
        child.setPosition(crossPosition, mainPosition);
      }

      child.layout();
      mainPosition += mainAxisSize + this.gap;
    });
  }

  protected calculateFlexDistribution(
    mainAxisSize: number
  ): FlexDistributionResult {
    // Early return for no children
    if (this.children.length === 0) {
      return { sizes: [], remainingSpace: mainAxisSize };
    }

    // Filter visible children and early return if none
    const visibleChildren = this.children.filter((child) => child.visible);
    if (visibleChildren.length === 0) {
      return { sizes: [], remainingSpace: mainAxisSize };
    }

    // Calculate total gap space
    const totalGapSpace = (visibleChildren.length - 1) * this.gap;
    const availableSpace = Math.max(0, mainAxisSize - totalGapSpace);

    // Calculate initial available space per child
    const baseSpacePerChild = Math.floor(
      availableSpace / visibleChildren.length
    );

    // Create unified array with all necessary information
    const childrenInfo = visibleChildren.map((child) => {
      const explicitSize = child.getExplicitSize();

      // If explicit size exists, use it
      if (this.direction === "row" ? explicitSize.width : explicitSize.height) {
        return {
          child,
          isFlexItem: child.getFlexGrow() > 0,
          flexGrow: child.getFlexGrow(),
          size:
            this.direction === "row"
              ? explicitSize.width!
              : explicitSize.height!,
          minSize:
            this.direction === "row"
              ? child.getMinWidth()
              : child.getMinHeight(),
          maxSize:
            this.direction === "row"
              ? child.getMaxWidth()
              : child.getMaxHeight(),
        };
      }

      // Otherwise, get preferred size with appropriate constraints
      const constraints: Size =
        this.direction === "row"
          ? { width: baseSpacePerChild, height: this.height }
          : { width: this.width, height: baseSpacePerChild };

      const preferredSize = child.getPreferredSize(constraints);

      return {
        child,
        isFlexItem: child.getFlexGrow() > 0,
        flexGrow: child.getFlexGrow(),
        size:
          this.direction === "row" ? preferredSize.width : preferredSize.height,
        minSize:
          this.direction === "row" ? child.getMinWidth() : child.getMinHeight(),
        maxSize:
          this.direction === "row" ? child.getMaxWidth() : child.getMaxHeight(),
      };
    });

    // Calculate total fixed size and total flex grow in one pass
    const { totalFixedSize, totalFlexGrow } = childrenInfo.reduce(
      (acc, info) => ({
        totalFixedSize: acc.totalFixedSize + (info.isFlexItem ? 0 : info.size), // Changed from preferredSize to size
        totalFlexGrow:
          acc.totalFlexGrow + (info.isFlexItem ? info.flexGrow : 0),
      }),
      { totalFixedSize: 0, totalFlexGrow: 0 }
    );

    // Calculate remaining space for flex items
    const remainingSpace = Math.max(0, availableSpace - totalFixedSize);

    // Calculate final sizes
    let usedSpace = 0;
    const sizes = childrenInfo.map((info) => {
      let size: number;

      if (info.isFlexItem) {
        const flexRatio = info.flexGrow / totalFlexGrow;
        const flexSpace = remainingSpace * flexRatio;
        const boundedFlexSpace = Math.min(info.maxSize, flexSpace);
        size = Math.floor(Math.max(info.minSize, boundedFlexSpace));
      } else {
        size = info.size; // Changed from preferredSize to size
      }

      usedSpace += size;
      return size;
    });

    return {
      sizes,
      remainingSpace: availableSpace - usedSpace,
    };
  }

  protected measureContent(availableSize: Size): Size {
    const visibleChildren = this.children.filter((child) => child.visible);
    if (visibleChildren.length === 0) {
      return { width: 0, height: 0 };
    }

    const isRow = this.direction === "row";
    const totalGap = Math.max(0, (visibleChildren.length - 1) * this.gap);

    // Get children's preferred sizes with available constraints
    const childrenSizes = visibleChildren.map((child) => {
      const childConstraints: Size = isRow
        ? { width: availableSize.width, height: this.getMaxHeight() }
        : { width: this.getMaxWidth(), height: availableSize.height };

      return child.getPreferredSize(childConstraints);
    });

    if (isRow) {
      // For row layout
      const totalWidth =
        childrenSizes.reduce((sum, size) => sum + size.width, 0) + totalGap;
      const maxHeight = Math.max(...childrenSizes.map((size) => size.height));
      return {
        width: totalWidth,
        height: maxHeight,
      };
    } else {
      // For column layout
      const maxWidth = Math.max(...childrenSizes.map((size) => size.width));
      const totalHeight =
        childrenSizes.reduce((sum, size) => sum + size.height, 0) + totalGap;
      return {
        width: maxWidth,
        height: totalHeight,
      };
    }
  }

  public setDirection(direction: FlexDirection): void {
    if (this.direction !== direction) {
      this.direction = direction;
      this.requestLayout();
    }
  }

  public setAlign(align: FlexAlign): void {
    if (this.align !== align) {
      this.align = align;
      this.requestLayout();
    }
  }

  public setJustify(justify: FlexJustify): void {
    if (this.justify !== justify) {
      this.justify = justify;
      this.requestLayout();
    }
  }

  public setGap(gap: number): void {
    if (this.gap !== gap) {
      if (gap < 0) throw new Error("Gap must be non-negative");
      this.gap = gap;
      this.requestLayout();
    }
  }
}
