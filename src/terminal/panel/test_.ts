import { PTYPanel } from "./PTYPanel.js";
import { PanelManager } from "./PanelManager.js";
import { DebugLogger } from "../DebugLogger.js";

DebugLogger.initialize({
  logFile: "pty-debug.log",
  appendToFile: true,
  flushInterval: 2000, // 2 seconds
  maxBufferSize: 16384, // 16KB
});

const main = () => {
  const cols = process.stdout.columns;
  const rows = process.stdout.rows;
  // DebugLogger.log(`Terminal size: ${cols}x${rows}`);

  const panel = new PTYPanel("test", {
    dimensions: { cols, rows },
    shell: "bash",
  });

  const panel2 = new PTYPanel("test2", {
    dimensions: { cols, rows },
    shell: "bash",
  });

  const panelManager = new PanelManager({ cols, rows }, panel);
  panelManager.splitPanel("test2", "vertical", panel2, 0.5);

  process.stdin.setRawMode(true);

  process.stdin.on("data", (data: string) => {
    panelManager.write(data);
  });

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, cleaning up...");
    process.exit(0);
  });

  process.stdout.on("resize", () => {
    const newCols = process.stdout.columns;
    const newRows = process.stdout.rows;

    panelManager.resize({ cols: newCols, rows: newRows });
  });
};

main();
