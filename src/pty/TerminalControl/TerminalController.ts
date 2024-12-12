import { EventEmitter } from "events";
import * as pty from "node-pty";
import { VT100Parser } from "./VT100Parser.js";
import { VT100Formatter } from "./VT100Formatter.js";
import { VT100Sequence, SequenceType } from "./Command.js";
import { CSISequence } from "./CSISequence.js";
import { CursorStateManager, CursorState } from "./CursorStateManager.js";
import { DebugLogger } from "../DebugLogger.js";

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
}

interface SequenceResponseHandler {
  pattern: RegExp;
  timeout: number;
  resolve: (response: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

// Current text attributes
interface TextAttributes {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  inverse: boolean;
  hidden: boolean;
  strike: boolean;
  foreground?: number;
  background?: number;
}

// Minimal screen buffer line
interface BufferLine {
  content: string;
  attributes: TextAttributes;
}

// Terminal state interface
interface TerminalState {
  attributes: TextAttributes;
  buffer: BufferLine[];
  modes: {
    applicationCursor: boolean;
    applicationKeypad: boolean;
    wrap: boolean;
    insert: boolean;
    originMode: boolean;
    autoWrap: boolean;
    bracketedPaste: boolean;
    mouseTracking: boolean;
  };
  viewport: {
    width: number;
    height: number;
    scrollTop: number;
    scrollBottom: number;
  };
  charset: {
    current: number;
    g0: number;
    g1: number;
  };
}

export declare interface TerminalController {
  on(event: "ready", listener: () => void): this;
  on(event: "command", listener: (command: string) => void): this;
  on(event: "text", listener: (text: string) => void): this;
}

export class TerminalController extends EventEmitter {
  private config: TerminalControllerConfig;
  private parser: VT100Parser;
  private state: TerminalState;
  private cursorStateManager: CursorStateManager;
  private ptyProcess!: pty.IPty;
  private responseHandlers: SequenceResponseHandler[];
  private responseBuffer: string;
  private defaultTimeout: number;

  constructor(config: TerminalControllerConfig) {
    super();
    this.cursorStateManager = new CursorStateManager();
    this.state = this.createInitialState();
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

  private createInitialState(): TerminalState {
    return {
      attributes: {
        bold: false,
        dim: false,
        italic: false,
        underline: false,
        blink: false,
        inverse: false,
        hidden: false,
        strike: false,
      },
      buffer: [],
      modes: {
        applicationCursor: false,
        applicationKeypad: false,
        wrap: true,
        insert: false,
        originMode: false,
        autoWrap: true,
        bracketedPaste: false,
        mouseTracking: false,
      },
      viewport: {
        width: 80, // Default terminal width
        height: 24, // Default terminal height
        scrollTop: 0,
        scrollBottom: 23, // height - 1
      },
      charset: {
        current: 0,
        g0: 0,
        g1: 0,
      },
    };
  }

  private async handleTerminalReady() {
    await this.setCursorPosition();
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

      this.state.viewport.width = newCols;
      this.state.viewport.height = newRows;
      this.state.viewport.scrollBottom = newRows - 1;

      this.emit("resize", { cols: newCols, rows: newRows });
    });

    // Exit handling
    this.ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      DebugLogger.log("PTY Exit", { exitCode });
      process.exit(exitCode);
    });

    // Initialize viewport state
    this.state.viewport.width = cols;
    this.state.viewport.height = rows;
    this.state.viewport.scrollBottom = rows - 1;
    process.nextTick(() => this.emit("ready"));
  }

  private handleInput(data: string): void {
    // Check for pending response handlers
    if (this.responseHandlers.length > 0) {
      this.responseBuffer += data.toString();

      // Try to match against all pending handlers
      for (let i = this.responseHandlers.length - 1; i >= 0; i--) {
        const handler = this.responseHandlers[i];
        const match = this.responseBuffer.match(handler.pattern);

        if (match) {
          // Clear the timeout
          clearTimeout(handler.timer);

          // Remove the handler
          this.responseHandlers.splice(i, 1);

          // Process the match
          handler.resolve(match);

          // Remove the matched portion from the buffer
          this.responseBuffer = this.responseBuffer.slice(match[0].length);

          // Don't forward this to PTY
          return;
        }
      }
    }
    // Forward unhandled input to PTY
    this.ptyProcess.write(data);
  }

  private handleOutput(data: string) {
    let outpuStr = "";
    const sequences = this.parser.parseString(data);
    for (const sequence of sequences) {
      const transformedSequences = this.handleSequence(sequence);
      transformedSequences.forEach((seq) => {
        DebugLogger.log("", VT100Formatter.format(seq));
        outpuStr += seq.toString();
      });
    }
    process.stdout.write(outpuStr);
  }

  private handleSequence(sequence: VT100Sequence): VT100Sequence[] {
    // Update cursor state
    this.cursorStateManager.processSequence(sequence);

    // Emit sequence event for external handlers
    this.emit("sequence", sequence);
    return [sequence];
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

  private async setCursorPosition() {
    const dsr = CSISequence.from(new Uint8Array([0x1b, 0x5b, 0x36, 0x6e])); // ESC [ 6 n
    const response = await this.sendSequenceWithResponse(
      dsr,
      /\x1b\[(\d+);(\d+)R/
    );

    const y = parseInt(response[1], 10);
    const x = parseInt(response[2], 10);
    this.cursorStateManager.setPosition(x, y);
  }
}
