import * as pty from "node-pty";
import { InputProcessor } from "./InputProcessor.js";
import { OutputProcessor } from "./OutputProcessor.js";
import { Middleware } from "./PtyStreamProcessor.js";

export class PtyManager {
  private ptyProcess: pty.IPty | null = null;
  private inputProcessor: InputProcessor;
  private outputProcessor: OutputProcessor;

  constructor() {
    this.inputProcessor = new InputProcessor();
    this.outputProcessor = new OutputProcessor();
    this.initialize();
  }

  private initialize() {
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
    process.stdin.pipe(this.inputProcessor).pipe(this.ptyProcess as any);

    this.ptyProcess.onData((data) => {
      this.outputProcessor._transform(
        Buffer.from(data),
        "utf8",
        (error: Error | null, transformedData: Buffer | undefined) => {
          if (!error && transformedData) {
            process.stdout.write(transformedData);
          }
        }
      );
    });

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

  public addInputMiddleware(middleware: Middleware): void {
    this.inputProcessor.addMiddleware(middleware);
  }

  public addOutputMiddleware(middleware: Middleware): void {
    this.outputProcessor.addMiddleware(middleware);
  }

  public removeMiddleware(middlewareId: string): void {
    this.inputProcessor.removeMiddleware(middlewareId);
    this.outputProcessor.removeMiddleware(middlewareId);
  }

  public kill() {
    this.ptyProcess?.kill();
    this.ptyProcess = null;
  }
}
