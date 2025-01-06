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
    const mainSize = isRow ? this.width : this.height;
    const crossSize = isRow ? this.height : this.width;
    const visibleChildren = this.children.filter((child) => child.visible);

    if (visibleChildren.length === 0) return;

    HierarchicalLogger.log(`${this.componentId}.calculateFlexDistribution()`);
    HierarchicalLogger.startGroup();
    const distribution = this.calculateFlexDistribution(mainSize);
    HierarchicalLogger.log(`Results`, {
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
        ? { width: mainAxisSize, height: Infinity }
        : { width: Infinity, height: mainAxisSize };

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
        child.setSize(mainAxisSize, crossAxisSize);
        child.setPosition(mainPosition, crossPosition);
      } else {
        child.setSize(crossAxisSize, mainAxisSize);
        child.setPosition(crossPosition, mainPosition);
      }

      child.layout();
      mainPosition += mainAxisSize + this.gap;
    });
  }

  protected calculateFlexDistribution(
    mainAxisSize: number
  ): FlexDistributionResult {
    const visibleChildren = this.children.filter((child) => child.visible);
    const totalGapSpace = (visibleChildren.length - 1) * this.gap;
    const availableSpace = Math.max(0, mainAxisSize - totalGapSpace);

    // Separate flex and non-flex items
    const flexItems: TerminalComponent[] = [];
    const fixedItems: TerminalComponent[] = [];
    let totalFixedSize = 0;

    visibleChildren.forEach((child) => {
      const preferredSize = child.getPreferredSize();
      if (child.getFlexGrow() > 0) {
        flexItems.push(child);
      } else {
        fixedItems.push(child);
        const size =
          this.direction === "row" ? preferredSize.width : preferredSize.height;
        totalFixedSize += size;
      }
    });

    // Calculate remaining space for flex items
    const remainingSpace = Math.max(0, availableSpace - totalFixedSize);

    if (flexItems.length === 0) {
      return {
        sizes: visibleChildren.map((child) => {
          const size =
            this.direction === "row"
              ? child.getPreferredSize().width
              : child.getPreferredSize().height;
          return size;
        }),
        remainingSpace,
      };
    }

    // Calculate total flex grow
    const totalFlexGrow = flexItems.reduce(
      (sum, item) => sum + item.getFlexGrow(),
      0
    );

    // Calculate sizes based on flex grow ratios
    const sizes: number[] = [];
    let usedSpace = 0;

    visibleChildren.forEach((child) => {
      let size: number;

      if (child.getFlexGrow() > 0) {
        // For flex items, calculate size based on flex ratio
        const flexRatio = child.getFlexGrow() / totalFlexGrow;
        const flexSpace = remainingSpace * flexRatio;

        // Ensure size respects min/max constraints
        const childMinSize =
          this.direction === "row" ? child.getMinWidth() : child.getMinHeight();

        // Use the flex space as the effective max size, bounded by component's max constraint
        const componentMaxSize =
          this.direction === "row" ? child.getMaxWidth() : child.getMaxHeight();
        const childMaxSize = Math.min(componentMaxSize, flexSpace);

        size = Math.floor(flexSpace);
        size = Math.max(childMinSize, Math.min(childMaxSize, size));
      } else {
        // For fixed items, use their preferred size
        size =
          this.direction === "row"
            ? child.getPreferredSize().width
            : child.getPreferredSize().height;
      }

      sizes.push(size);
      usedSpace += size;
    });

    return {
      sizes,
      remainingSpace: availableSpace - usedSpace,
    };
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
