import * as pty from "node-pty";
import { Window } from "./Window.js";

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_NAME = "xterm-color";

export interface TerminalConfig {
  cols?: number;
  rows?: number;
  name?: string;
  stdout: NodeJS.WriteStream;
}

export class Terminal {
  private ptyProcess!: pty.IPty;
  private config: TerminalConfig;
  private window: Window;

  constructor(config: TerminalConfig) {
    this.config = config;
    this.window = new Window({
      size: {
        width: config.cols || DEFAULT_COLS,
        height: config.rows || DEFAULT_ROWS,
      },
      directory: process.cwd(),
      title: config.name || DEFAULT_NAME,
      stdout: config.stdout,
    });
    const shell = this.getShell();
    this.ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color", //config.name || DEFAULT_NAME,
      cols: this.config.cols || DEFAULT_COLS,
      rows: this.config.rows || DEFAULT_ROWS,
      cwd: process.cwd(),
      env: {
        ...process.env,
        TERM: "xterm-256color",
      },
    });
    this.ptyProcess.onData(this.stdoutHandler.bind(this));
    this.ptyProcess.onExit(this.exitHandler.bind(this));
  }

  private getShell() {
    return process.platform === "win32"
      ? "powershell.exe"
      : process.platform === "darwin"
      ? "/bin/zsh"
      : process.env.SHELL || "bash";
  }

  public write(data: string) {
    this.ptyProcess.write(data);
  }

  private stdoutHandler(data: string) {
    this.window.process(data);
  }

  private exitHandler(e: { exitCode: number; signal?: number }) {
    process.exit(e.exitCode);
  }
}
