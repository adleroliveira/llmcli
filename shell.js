import EventEmitter from "events";
import { spawn } from "node-pty";

class PTYController extends EventEmitter {
  constructor() {
    super();
    this.pty = spawn("bash", [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
    });

    // Put stdin in raw mode to get control sequences
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    this.isWaitingForResponse = false;
    this.responseBuffer = "";

    // Setup stdin handling with filtering
    process.stdin.on("data", (data) => {
      // Handle Ctrl-C for clean exit
      if (data === "\u0003") {
        process.exit();
      }

      // If waiting for DSR response, check for it
      if (this.isWaitingForResponse) {
        this.responseBuffer += data;
        const response = this.parseResponse(this.responseBuffer);
        if (response) {
          this.emit("response", response);
          this.isWaitingForResponse = false;
          this.responseBuffer = "";
          return; // Don't forward the response to PTY
        }
      }

      // Forward other input to PTY
      this.pty.write(data);
    });

    // Setup PTY output handling
    this.pty.onData((data) => {
      process.stdout.write(data);
    });
  }

  async requestCursorPosition() {
    return new Promise((resolve) => {
      this.once("response", (position) => {
        resolve(position);
      });

      this.isWaitingForResponse = true;
      this.responseBuffer = "";
      process.stdout.write("\x1b[6n");
    });
  }

  parseResponse(data) {
    const match = data.match(/\x1b\[(\d+);(\d+)R/);
    if (match) {
      return {
        row: parseInt(match[1], 10),
        col: parseInt(match[2], 10),
      };
    }
    return null;
  }
}

// Usage example
async function main() {
  const controller = new PTYController();

  try {
    const position = await controller.requestCursorPosition();
    console.log("Cursor position:", position);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
