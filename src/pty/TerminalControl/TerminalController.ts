import { EventEmitter } from "events";
import * as pty from "node-pty";
import { VT100Parser } from "./VT100Parser.js";
import { VT100Formatter } from "./VT100Formatter.js";
import { VT100Sequence } from "./Command.js";
import { CursorStateManager, CursorState } from "./CursorStateManager.js";
import { ViewportStateManager, ViewportState } from "./ViewportStateManager.js";
import { CharsetStateManager, CharsetState } from "./CharsetStateManager.js";
import { ModeStateManager, ModeState } from "./ModeStateManager.js";
import { PromptStateManager } from "./PromptStateManager.js";
import { LineBufferManager, LineBufferState } from "./LineBufferManager.js";
import { DebugLogger } from "./DebugLogger.js";

DebugLogger.initialize({
  logFile: "pty-debug.log",
  appendToFile: true,
  flushInterval: 2000, // 2 seconds
  maxBufferSize: 16384, // 16KB
});

export interface TerminalControllerConfig {
  maxStringLength?: number;
  support8BitC1?: boolean;
  strictMode?: boolean;
  debug?: boolean;
  responseTimeout?: number;
  activeStreamTimeout?: number;
}

interface SequenceResponseHandler {
  pattern: RegExp;
  timeout: number;
  resolve: (response: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

// Terminal state interface
interface TerminalState {
  cursor: CursorState;
  viewport: ViewportState;
  charset: CharsetState;
  mode: ModeState;
  lineBuffer: LineBufferState;
}

export declare interface TerminalController {
  on(event: "ready", listener: () => void): this;
  on(event: "command", listener: (command: string) => void): this;
  on(event: "text", listener: (text: string) => void): this;
  on(event: "resize", listener: () => void): this;
  on(event: "streamActive", listener: (status: boolean) => void): this;
}

const DEFATUL_STREAM_ACTIVE_TIMEOUT = 500;

export class TerminalController extends EventEmitter {
  private config: TerminalControllerConfig;
  private parser: VT100Parser;

  // State Management
  private cursorStateManager: CursorStateManager;
  private viewportStateManager: ViewportStateManager;
  private charsetStateManager: CharsetStateManager;
  private modeStateManager: ModeStateManager;
  private lineBufferManager: LineBufferManager;
  private promptStateManager: PromptStateManager;

  private ptyProcess!: pty.IPty;
  private responseHandlers: SequenceResponseHandler[];
  private responseBuffer: string;
  private defaultTimeout: number;
  private streamActive: boolean = false;
  private streamActiveTimer: NodeJS.Timeout | null = null;

  constructor(config: TerminalControllerConfig) {
    super();

    this.viewportStateManager = new ViewportStateManager(this);
    this.cursorStateManager = new CursorStateManager(this);
    this.lineBufferManager = new LineBufferManager(this);
    this.charsetStateManager = new CharsetStateManager();
    this.modeStateManager = new ModeStateManager();
    this.promptStateManager = new PromptStateManager(this, "[⚡]");

    this.config = config;
    this.responseHandlers = [];
    this.responseBuffer = "";
    this.defaultTimeout = config.responseTimeout || 5000; // 5 second default

    this.parser = new VT100Parser({
      support8BitC1: config.support8BitC1 ?? true,
      maxStringLength: config.maxStringLength ?? 2048,
      strictMode: config.strictMode ?? true,
    });

    this.setupTerminal();
    this.on("ready", this.handleTerminalReady.bind(this));
  }

  private async handleTerminalReady() {
    await this.cursorStateManager.setup(this);
    this.on("streamActive", (status: boolean) => {
      if (!status) DebugLogger.log("State", this.getState());
    });
  }

  private getShell() {
    return process.platform === "win32"
      ? "powershell.exe"
      : process.platform === "darwin"
      ? "/bin/zsh"
      : process.env.SHELL || "bash";
  }

  private setupTerminal(): void {
    const shell = this.getShell();
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    // Initialize viewport state
    this.viewportStateManager.resize(cols, rows);

    this.ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: cols,
      rows: rows,
      env: {
        ...process.env,
        TERM: "xterm-256color",
      },
    });

    // Handle PTY output
    this.ptyProcess.onData(this.handleOutput.bind(this));

    // Enhanced input handling
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", this.handleInput.bind(this));

    // Handle resize events
    process.stdout.on("resize", () => {
      const newCols = process.stdout.columns || 80;
      const newRows = process.stdout.rows || 24;

      // Resize the PTY
      this.ptyProcess.resize(newCols, newRows);
      this.viewportStateManager.resize(newCols, newRows);
      this.emit("resize", { cols: newCols, rows: newRows });
    });

    // Exit handling
    this.ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      DebugLogger.log("PTY Exit", { exitCode });
      process.exit(exitCode);
    });

    process.nextTick(() => this.emit("ready"));
  }

  private handleInput(data: string): void {
    this.setActiveStream();
    // Check for pending response handlers
    if (this.responseHandlers.length > 0) {
      this.responseBuffer += data.toString();

      // Try to match against all pending handlers
      for (let i = this.responseHandlers.length - 1; i >= 0; i--) {
        const handler = this.responseHandlers[i];
        const match = this.responseBuffer.match(handler.pattern);

        if (match) {
          clearTimeout(handler.timer);
          this.responseHandlers.splice(i, 1);
          handler.resolve(match);
          this.responseBuffer = this.responseBuffer.slice(match[0].length);

          return;
        }
      }
    }
    // Forward unhandled input to PTY
    this.ptyProcess.write(data);
  }

  private handleOutput(data: string) {
    this.setActiveStream();
    let outputStr = "";
    const sequences = this.parser.parseString(data);

    for (const sequence of sequences) {
      const handledSequence = this.handleSequence(sequence);
      DebugLogger.log("", VT100Formatter.format(handledSequence));
      outputStr += handledSequence.toString();
    }

    process.stdout.write(outputStr);
  }

  private handleSequence(
    sequence: VT100Sequence,
    skipRecursion: boolean = false
  ): VT100Sequence {
    // Update all state managers except prompt
    this.charsetStateManager.processSequence(sequence);
    this.modeStateManager.processSequence(sequence);
    this.viewportStateManager.processSequence(sequence);
    this.cursorStateManager.processSequence(sequence);
    this.lineBufferManager.processSequence(sequence);

    // if (!skipRecursion) {
    //   const transformedSequence =
    //     this.promptStateManager.processSequence(sequence);
    //   if (transformedSequence !== sequence) {
    //     return this.handleSequence(transformedSequence, true);
    //   }
    // }

    return sequence;
  }

  public sendSequence(sequence: VT100Sequence): void {
    this.setActiveStream();
    process.stdout.write(sequence.toString());
  }

  public async sendSequenceWithResponse(
    sequence: VT100Sequence,
    responsePattern: RegExp,
    timeout?: number
  ): Promise<RegExpMatchArray> {
    return new Promise((resolve, reject) => {
      const handler: SequenceResponseHandler = {
        pattern: responsePattern,
        timeout: timeout || this.defaultTimeout,
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.responseHandlers.indexOf(handler);
          if (index !== -1) {
            this.responseHandlers.splice(index, 1);
            reject(new Error("Response timeout"));
          }
        }, timeout || this.defaultTimeout),
      };

      // Add the handler before sending the sequence
      this.responseHandlers.push(handler);

      // Send the sequence
      process.stdout.write(sequence.toString());
    });
  }

  private setActiveStream() {
    if (!this.streamActive) {
      this.streamActive = true;
      this.emit("streamActive", true);
    }
    if (this.streamActiveTimer) clearTimeout(this.streamActiveTimer);
    this.streamActiveTimer = setTimeout(() => {
      this.streamActive = false;
      this.emit("streamActive", false);
      this.streamActiveTimer = null;
    }, this.config.activeStreamTimeout || DEFATUL_STREAM_ACTIVE_TIMEOUT);
  }

  public getState(): TerminalState {
    return {
      cursor: this.cursorStateManager.getState(),
      viewport: this.viewportStateManager.getState(),
      charset: this.charsetStateManager.getState(),
      mode: this.modeStateManager.getState(),
      lineBuffer: this.lineBufferManager.getState(),
    };
  }

  public getViewPortStateManager(): ViewportStateManager {
    return this.viewportStateManager;
  }

  public getCursorStateManager(): CursorStateManager {
    return this.cursorStateManager;
  }

  public getLineBufferManager(): LineBufferManager {
    return this.lineBufferManager;
  }

  public getPromptStateManager(): PromptStateManager {
    return this.promptStateManager;
  }
}
