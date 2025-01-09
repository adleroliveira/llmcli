import { HierarchicalLogger } from "../HierarchicalLogger.js";
import {
  TerminalComponent,
  ComponentProps,
  Constraints,
} from "../TerminalComponent.js";
import { Size } from "../index.js";

interface FlexDistributionResult {
  childrenDistribution: Size[];
  availableSize: Size;
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
  private lastChildrenSizeDistribution: FlexDistributionResult | null = null;

  constructor(props: FlexContainerProps = {}) {
    super(props);

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

  private calculateChildrenSizeDistribution(): void {
    if (
      this.lastChildrenSizeDistribution &&
      this.lastChildrenSizeDistribution.availableSize.width == this.width &&
      this.lastChildrenSizeDistribution.availableSize.height == this.height
    ) {
      return;
    }
    this.measureContent(this.size);
  }

  protected layoutChildren(): void {
    if (this.children.length === 0) return;
    const visibleChildren = this.children.filter((child) => child.visible);
    if (visibleChildren.length === 0) return;

    const isRow = this.direction === "row";

    if (
      !this.lastChildrenSizeDistribution ||
      this.lastChildrenSizeDistribution.availableSize.width !== this.width ||
      this.lastChildrenSizeDistribution.availableSize.height !== this.height
    ) {
      HierarchicalLogger.log(
        `${this.componentId}::calculateChildrenSizeDistribution()`
      );
      HierarchicalLogger.startGroup();
      this.calculateChildrenSizeDistribution();
      HierarchicalLogger.endGroup();
    }

    let childrenSizeDistribution = this.lastChildrenSizeDistribution!;
    const remainingSpace = childrenSizeDistribution.remainingSpace;

    let mainPosition = 0;
    let crossPosition = 0;

    visibleChildren.forEach((child, i) => {
      let effectiveGap = this.gap;

      if (this.justify !== "start" && remainingSpace > 0) {
        const borderSpace = this.getBorderSpace();
        switch (this.justify) {
          case "center": {
            // Calculate total content width including gaps
            const totalContentWidth = visibleChildren.reduce((sum, _, idx) => {
              const size = childrenSizeDistribution.childrenDistribution[idx];
              return sum + (isRow ? size.width : size.height);
            }, (visibleChildren.length - 1) * this.gap);

            // Center the entire content block, accounting for border space
            mainPosition =
              Math.floor((remainingSpace + totalContentWidth) / 2) -
              Math.floor(totalContentWidth / 2);
          }
          case "end": {
            mainPosition = remainingSpace + Math.floor(borderSpace); // Account for left border
            break;
          }
          case "space-between": {
            mainPosition += Math.floor(borderSpace); // Account for left border
            if (visibleChildren.length > 1) {
              const totalGaps = visibleChildren.length - 1;
              effectiveGap = Math.floor(remainingSpace / totalGaps);
              // Add any leftover pixels to the last gap
              const leftoverSpace = remainingSpace - effectiveGap * totalGaps;
              if (leftoverSpace > 0 && i === visibleChildren.length - 1) {
                mainPosition += leftoverSpace;
              }
            }
            break;
          }
          case "space-around": {
            const spacePerSide = Math.floor(
              remainingSpace / (visibleChildren.length * 2)
            );
            mainPosition = spacePerSide + Math.floor(borderSpace); // Account for left border
            effectiveGap = spacePerSide * 2;
            // Distribute any remaining pixels at the start
            const totalSpace = spacePerSide * visibleChildren.length * 2;
            const leftoverSpace = remainingSpace - totalSpace;
            if (leftoverSpace > 0) {
              mainPosition += leftoverSpace;
            }
            break;
          }
        }
      }

      // Set constraints and position
      const mainAxisSize = isRow
        ? childrenSizeDistribution.childrenDistribution[i].width
        : childrenSizeDistribution.childrenDistribution[i].height;

      let crossAxisSize = isRow
        ? childrenSizeDistribution.childrenDistribution[i].height
        : childrenSizeDistribution.childrenDistribution[i].width;
      const crossSize = isRow ? this.height : this.width;

      if (this.align === "stretch") {
        crossAxisSize = crossSize;
      } else {
        const borderSpace = this.getBorderSpace();
        const effectiveCrossSize = crossSize - borderSpace;
        const availableCrossSpace = effectiveCrossSize - crossAxisSize;
        switch (this.align) {
          case "center":
            crossPosition = Math.floor(availableCrossSpace / 2);
            break;
          case "end":
            crossPosition = availableCrossSpace;
            break;
        }
      }

      // Set layout constraints before positioning
      if (isRow) {
        child.setLayoutConstraints({
          minWidth: mainAxisSize,
          maxWidth: mainAxisSize,
          minHeight: this.align === "stretch" ? crossSize : 0,
          maxHeight: crossSize,
        });

        // Apply gap before setting position (except for first child)
        if (i > 0) {
          mainPosition += effectiveGap;
        }
        child.setPosition(mainPosition, crossPosition);
      } else {
        child.setLayoutConstraints({
          minWidth: this.align === "stretch" ? crossSize : 0,
          maxWidth: crossSize,
          minHeight: mainAxisSize,
          maxHeight: mainAxisSize,
        });

        // Apply gap before setting position (except for first child)
        if (i > 0) {
          mainPosition += effectiveGap;
        }
        child.setPosition(crossPosition, mainPosition);
      }

      child.layout();
      mainPosition += mainAxisSize;
    });
  }

  private calculateTotalSize(
    childrenSizes: Size[],
    availableSize: Size,
    totalGap: number,
    isRow: boolean
  ): Size {
    if (isRow) {
      // Add up all widths plus the total gap space
      const totalWidth =
        childrenSizes.reduce((sum, size) => sum + size.width, 0) + totalGap;
      const maxHeight = Math.max(...childrenSizes.map((size) => size.height));
      const finalHeight =
        this.align === "stretch" ? availableSize.height : maxHeight;

      return {
        width: totalWidth,
        height: finalHeight,
      };
    } else {
      const maxWidth = Math.max(...childrenSizes.map((size) => size.width));
      const totalHeight =
        childrenSizes.reduce((sum, size) => sum + size.height, 0) + totalGap;
      const finalWidth =
        this.align === "stretch" ? availableSize.width : maxWidth;

      return {
        width: finalWidth,
        height: totalHeight,
      };
    }
  }

  protected measureContent(availableSize: Size): Size {
    if (this.children.length === 0) {
      return {
        width: this._explicitWidth || this.width,
        height: this._explicitHeight || this.height,
      };
    }

    const visibleChildren = this.children.filter((child) => child.visible);
    if (visibleChildren.length === 0) {
      return {
        width: this._explicitWidth || this.width,
        height: this._explicitHeight || this.height,
      };
    }

    const isRow = this.direction === "row";
    // Calculate gaps based on direction and visible children
    const gapsNeeded = visibleChildren.length - 1;
    const totalGap = Math.max(0, gapsNeeded * this.gap);
    const borderSpace = this.getBorderSpace();

    // Account for border space AND gaps when calculating available space for content
    const mainAxisSpaceAfterGaps = isRow
      ? Math.max(0, availableSize.width - totalGap)
      : Math.max(0, availableSize.height - totalGap);

    // Rest of your existing flex calculation logic stays exactly the same
    const childrenInformation = visibleChildren.map((child) => {
      return {
        minWidth: child.getMinWidth(),
        strictMinWidth: child.getStrictMinWidth(),
        maxWidth: child.getMaxWidth(),
        minHeight: child.getMinHeight(),
        strictMinHeight: child.getStrictMinHeight(),
        maxHeight: child.getMaxHeight(),
        flexGrow: child.getFlexGrow(),
        id: child.getComponentId(),
        component: child,
      };
    });

    // Your existing all-flex optimization
    const allChildrenHaveFlexGrow = childrenInformation.every(
      (child) => child.flexGrow > 0
    );

    if (allChildrenHaveFlexGrow) {
      const totalFlexGrow = childrenInformation.reduce(
        (sum, child) => sum + child.flexGrow,
        0
      );

      const childrenSizes = childrenInformation.map((child) => {
        const strictMin = isRow ? child.strictMinWidth : child.strictMinHeight;

        // First allocate minimum sizes
        let mainAxisSize = strictMin;

        // Then distribute remaining space according to flex proportions
        const remainingSpace =
          mainAxisSpaceAfterGaps -
          childrenInformation.reduce(
            (sum, c) => sum + (isRow ? c.strictMinWidth : c.strictMinHeight),
            0
          );

        if (remainingSpace > 0) {
          const extraSpace = Math.floor(
            (remainingSpace * child.flexGrow) / totalFlexGrow
          );
          mainAxisSize += extraSpace;
        }

        return isRow
          ? {
              width: mainAxisSize,
              height: availableSize.height - borderSpace,
            }
          : {
              width: availableSize.width - borderSpace,
              height: mainAxisSize,
            };
      });

      const totalSize = this.calculateTotalSize(
        childrenSizes,
        availableSize,
        totalGap,
        isRow
      );

      this.lastChildrenSizeDistribution = {
        childrenDistribution: childrenSizes,
        availableSize,
        remainingSpace: 0,
      };

      return totalSize;
    }

    // Handle mixed flex/non-flex case
    // Phase 1: Get initial natural sizes
    const childrenNaturalSizes = childrenInformation.map((child) => {
      const childConstraints: Size = isRow
        ? {
            width: mainAxisSpaceAfterGaps,
            height: availableSize.height,
          }
        : {
            width: availableSize.width,
            height: mainAxisSpaceAfterGaps,
          };

      return child.component.getPreferredSize(childConstraints);
    });

    const totalNaturalSize = this.calculateTotalSize(
      childrenNaturalSizes,
      availableSize,
      totalGap,
      isRow
    );

    // Check if content fits within available space
    const mainAxisNaturalSize = isRow
      ? totalNaturalSize.width
      : totalNaturalSize.height;
    const availableMainAxisSize = isRow
      ? availableSize.width - borderSpace
      : availableSize.height - borderSpace;

    if (mainAxisNaturalSize <= availableMainAxisSize) {
      this.lastChildrenSizeDistribution = {
        childrenDistribution: childrenNaturalSizes,
        availableSize,
        remainingSpace: availableMainAxisSize - mainAxisNaturalSize,
      };
      return totalNaturalSize;
    }

    // Phase 2: Distribution when space is constrained
    const flexChildren = childrenInformation.filter(
      (child) => child.flexGrow > 0
    );
    const nonFlexChildren = childrenInformation.filter(
      (child) => child.flexGrow === 0
    );

    // First handle non-flex children
    const nonFlexSizes = nonFlexChildren.map((child, index) => {
      const originalIndex = childrenInformation.indexOf(child);
      const naturalSize = isRow
        ? childrenNaturalSizes[originalIndex].width
        : childrenNaturalSizes[originalIndex].height;
      const strictMin = isRow ? child.strictMinWidth : child.strictMinHeight;

      // Non-flex children maintain their natural size or shrink to strict minimum if needed
      const mainAxisSize = Math.max(strictMin, naturalSize);

      return {
        child,
        mainAxisSize,
        originalIndex,
      };
    });

    // Calculate remaining space for flex children
    const nonFlexTotalSize = nonFlexSizes.reduce(
      (sum, item) => sum + item.mainAxisSize,
      0
    );
    const remainingSpaceForFlex =
      availableMainAxisSize - nonFlexTotalSize - totalGap;

    // Calculate total flex units
    const totalFlexGrow = flexChildren.reduce(
      (sum, child) => sum + child.flexGrow,
      0
    );

    // Distribute remaining space among flex children
    const flexSizes = flexChildren.map((child) => {
      const originalIndex = childrenInformation.indexOf(child);
      const strictMin = isRow ? child.strictMinWidth : child.strictMinHeight;

      // Calculate size based on flex proportion
      const flexProportion = child.flexGrow / totalFlexGrow;
      const allocatedSize = Math.max(
        strictMin,
        Math.floor(remainingSpaceForFlex * flexProportion)
      );

      return {
        child,
        mainAxisSize: allocatedSize,
        originalIndex,
      };
    });

    // Combine all sizes in original order
    const allSizes = [...nonFlexSizes, ...flexSizes].sort(
      (a, b) => a.originalIndex - b.originalIndex
    );

    // Create final size constraints
    const childrenFinalSizes = allSizes.map(({ child, mainAxisSize }) => {
      const childConstraints: Size = isRow
        ? { width: mainAxisSize, height: availableSize.height - borderSpace }
        : { width: availableSize.width - borderSpace, height: mainAxisSize };

      return child.component.getPreferredSize(childConstraints);
    });

    const finalSize = this.calculateTotalSize(
      childrenFinalSizes,
      availableSize,
      totalGap,
      isRow
    );

    this.lastChildrenSizeDistribution = {
      childrenDistribution: childrenFinalSizes,
      availableSize,
      remainingSpace: 0,
    };

    return finalSize;
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

  protected requestLayout(): void {
    this.lastChildrenSizeDistribution = null;
    super.requestLayout();
  }

  protected onChildSizeChanged(newSize: Size, child: TerminalComponent): void {
    this.lastChildrenSizeDistribution = null;
    super.onChildSizeChanged(newSize, child);
  }

  // TODO: Add cache invalidation to chilConstraintChange and childVisibilityChange
}
