import { App } from "./App.js";
import { UpdateSource } from "./TerminalComponent.js";
import { TerminalRenderer } from "./TerminalRenderer.js";
import { EventEmitter } from "events";
import { VT100Formatter } from "../VT100Formatter.js";
import { VT100Parser } from "../VT100Parser.js";
import { DebugLogger } from "../DebugLogger.js";

DebugLogger.initialize({
  logFile: "pty-debug.log",
  appendToFile: true,
  flushInterval: 2000, // 2 seconds
  maxBufferSize: 16384, // 16KB
});

const parser = new VT100Parser({
  support8BitC1: true,
  maxStringLength: 2048,
  strictMode: true,
});

export interface TerminalManagerOptions {
  useAlternateBuffer?: boolean;
}

export class TerminalManager extends EventEmitter {
  private app: App;
  private renderer: TerminalRenderer;
  private renderPending: boolean = false;
  private resizePending: boolean = false;
  private destroyed: boolean = false;

  constructor(app: App, options: TerminalManagerOptions = {}) {
    super();
    this.app = app;

    this.renderer = new TerminalRenderer({
      useAlternateBuffer: options.useAlternateBuffer ?? true,
    });

    // Set up event listeners
    this.app.addEventListener(
      "renderNeeded",
      this.handleRenderNeeded.bind(this)
    );

    // Bind cleanup to process events
    this.setupCleanup();
  }

  private handleRenderNeeded = () => {
    if (!this.renderPending && !this.destroyed) {
      this.renderPending = true;
      process.nextTick(() => {
        this.render();
        this.renderPending = false;
      });
    }
  };

  private handleResize = () => {
    if (this.destroyed || this.resizePending) return;

    this.resizePending = true;
    process.nextTick(() => {
      const { columns, rows } = process.stdout;
      this.app.resize(columns, rows);
      this.resizePending = false;
    });
  };

  private render() {
    // DebugLogger.log("App.render() called");
    if (this.destroyed) return;

    try {
      // Update the app's state
      this.app.requestUpdate(UpdateSource.Render);

      // Ensure all updates are complete
      process.nextTick(() => {
        const screenBuffer = this.app.getBuffer();
        const output = this.renderer.render(
          screenBuffer,
          this.app.getAbsoluteCursorPosition()
        );
        process.stdout.write(output);
        // DebugLogger.log("App.render() complete");
      });
    } catch (error) {
      console.error("Render error:", error);
    }
  }

  public initialize(): void {
    if (this.destroyed) return;

    const initalizationData = this.renderer.initialize();
    // for (const sequence of parser.parseString(initalizationData)) {
    //   DebugLogger.log(VT100Formatter.format(sequence));
    // }

    // Write initialization sequences
    process.stdout.write(initalizationData);

    // Set up resize handler
    process.stdout.on("resize", this.handleResize);

    // Initial render
    this.render();
  }

  private setupCleanup(): void {
    const cleanup = () => {
      if (this.destroyed) return;
      this.destroy();
    };

    // Use once instead of on to ensure cleanup only happens once
    process.once("SIGINT", cleanup);
    process.once("SIGTERM", cleanup);
    process.once("exit", cleanup);
  }

  public destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    // Remove the resize listener
    process.stdout.removeListener("resize", this.handleResize);

    // Clean up the terminal state
    process.stdout.write(this.renderer.cleanup());

    // Clean up event listeners
    this.removeAllListeners();

    // Destroy the app
    this.app.destroy();
    process.exit(0);
  }
}
