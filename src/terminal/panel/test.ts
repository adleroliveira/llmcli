type Cell = {
  value: string;
  attributes: Record<string, any>;
};

type SplitOptions = {
  direction: "vertical" | "horizontal";
  proportions: number[];
};

class RootMatrix {
  private buffer: Cell[][];

  constructor(width: number, height: number) {
    // Initialize buffer with empty cells
    this.buffer = Array(height)
      .fill(null)
      .map(() =>
        Array(width)
          .fill(null)
          .map(() => ({
            value: "",
            attributes: {},
          }))
      );
  }

  createVirtualBuffer(
    startX: number,
    startY: number,
    width: number,
    height: number
  ) {
    // Create an array with the correct length for proper iteration
    const virtualBuffer = Array(height);

    return new Proxy(virtualBuffer, {
      get: (target, prop) => {
        // Handle length property
        if (prop === "length") {
          return height;
        }

        // Handle array methods
        if (prop === "forEach" || prop === "map") {
          return Array.prototype[prop].bind(target);
        }

        if (typeof prop === "number" && prop >= 0 && prop < height) {
          // Cache the row proxy if it doesn't exist
          if (!target[prop]) {
            const rowArray = Array(width);
            target[prop] = new Proxy(rowArray, {
              get: (target, innerProp) => {
                if (innerProp === "length") {
                  return width;
                }
                if (
                  typeof innerProp === "number" &&
                  innerProp >= 0 &&
                  innerProp < width
                ) {
                  return this.buffer[startY + prop][startX + innerProp];
                }
                return undefined;
              },
              set: (target, innerProp, value) => {
                if (
                  typeof innerProp === "number" &&
                  innerProp >= 0 &&
                  innerProp < width
                ) {
                  this.buffer[startY + prop][startX + innerProp] = value;
                  return true;
                }
                return false;
              },
            });
          }
          return target[prop];
        }
        return undefined;
      },
    }) as Cell[][];
  }

  // Method to visualize the entire matrix
  print() {
    this.buffer.forEach((row) => {
      console.log(row.map((cell) => cell.value || " ").join(""));
    });
  }

  // Get the full buffer (for debugging)
  getBuffer(): Cell[][] {
    return this.buffer;
  }
}

class Panel {
  private buffer: Cell[][];
  private width: number;
  private height: number;

  constructor(virtualBuffer: Cell[][], width: number, height: number) {
    this.buffer = virtualBuffer;
    this.width = width;
    this.height = height;
  }

  clearBuffer() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x].value = "";
        this.buffer[y][x].attributes = {};
      }
    }
  }

  fillWith(value: string) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x].value = value;
      }
    }
  }

  writeAt(x: number, y: number, value: string) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new Error("Coordinates out of bounds");
    }
    this.buffer[y][x].value = value;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}

class PanelManager {
  private rootMatrix: RootMatrix;
  private panels: Panel[] = [];
  private borders: { x: number; y: number }[] = [];

  constructor(width: number, height: number) {
    this.rootMatrix = new RootMatrix(width, height);
    // Create initial panel covering the entire matrix
    const virtualBuffer = this.rootMatrix.createVirtualBuffer(
      0,
      0,
      width,
      height
    );
    const initialPanel = new Panel(virtualBuffer, width, height);
    this.panels.push(initialPanel);
  }

  split(panelIndex: number, options: SplitOptions): Panel[] {
    const panel = this.panels[panelIndex];
    if (!panel) throw new Error("Invalid panel index");

    const { direction, proportions } = options;
    if (Math.abs(proportions.reduce((a, b) => a + b, 0) - 1) > 0.0001) {
      throw new Error("Proportions must sum to 1");
    }

    const width = panel.getWidth();
    const height = panel.getHeight();
    const newPanels: Panel[] = [];
    let currentOffset = 0;

    // Remove the original panel
    this.panels.splice(panelIndex, 1);

    // Calculate and create new panels
    proportions.forEach((proportion, i) => {
      let panelWidth = width;
      let panelHeight = height;
      let startX = 0;
      let startY = 0;

      if (direction === "vertical") {
        panelWidth = Math.floor(width * proportion);
        startX = currentOffset;
        currentOffset += panelWidth;
        // Add border if not last panel
        if (i < proportions.length - 1) {
          this.borders.push({ x: startX + panelWidth, y: startY });
          currentOffset += 1; // Account for border
        }
      } else {
        panelHeight = Math.floor(height * proportion);
        startY = currentOffset;
        currentOffset += panelHeight;
        // Add border if not last panel
        if (i < proportions.length - 1) {
          this.borders.push({ x: startX, y: startY + panelHeight });
          currentOffset += 1; // Account for border
        }
      }

      const virtualBuffer = this.rootMatrix.createVirtualBuffer(
        startX,
        startY,
        panelWidth,
        panelHeight
      );
      const newPanel = new Panel(virtualBuffer, panelWidth, panelHeight);
      newPanels.push(newPanel);
      this.panels.push(newPanel);
    });

    return newPanels;
  }

  getPanels(): Panel[] {
    return this.panels;
  }

  printMatrix() {
    this.rootMatrix.print();
  }
}

// Example usage:
const manager = new PanelManager(20, 10);
manager.getPanels()[0].fillWith("A");
console.log(manager.getPanels()[0]);

// // Split the panel vertically into two panels with 40/60 ratio
// const newPanels = manager.split(0, {
//   direction: "vertical",
//   proportions: [0.4, 0.6],
// });

// // Fill the new panels with different characters
// newPanels[0].fillWith("B");
// newPanels[1].fillWith("C");

// // Print the result
// manager.printMatrix();
