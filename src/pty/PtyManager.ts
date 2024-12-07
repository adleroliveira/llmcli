import * as pty from "node-pty";
import {
  TerminalStreamProcessor,
  TerminalMiddleware,
} from "./TerminalStreamProcessor.js";

export class PtyManager {
  private ptyProcess: pty.IPty | null = null;
  private processor = new TerminalStreamProcessor();

  constructor() {}

  public initialize() {
    const env = {
      ...process.env,
      BASH_SILENCE_DEPRECATION_WARNING: "1",
    };

    this.ptyProcess = pty.spawn(this.getShell(), [], {
      name: "xterm-color",
      cols: process.stdout.columns,
      rows: process.stdout.rows,
      cwd: process.cwd(),
      env,
    });

    process.stdin.setRawMode(true);
    process.stdin
      .pipe(this.processor.createInputStream())
      .pipe(this.ptyProcess as any);

    this.ptyProcess.onData(
      this.processor.createOutputHandler((data) => {
        process.stdout.write(data);
      })
    );

    process.stdout.on("resize", () => {
      this.ptyProcess?.resize(process.stdout.columns, process.stdout.rows);
    });
  }

  private getShell() {
    return process.platform === "win32"
      ? "powershell.exe"
      : process.platform === "darwin"
      ? "/bin/zsh"
      : process.env.SHELL || "bash";
  }

  public use(middleware: TerminalMiddleware): void {
    this.processor.use(middleware);
  }

  public kill() {
    this.ptyProcess?.kill();
    this.ptyProcess = null;
  }
}
