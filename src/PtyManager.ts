import * as pty from "node-pty";
import { Transform } from "stream";

export interface PtyManagerConfig {
  defaultPrompt: string;
  aiModePrompt: string;
}

export class InputInterceptor extends Transform {
  constructor(private ptyManager: PtyManager) {
    super();
  }

  _transform(chunk: Buffer, _encoding: string, callback: Function) {
    const input = chunk.toString();

    if (input.trim() === "/") {
      this.ptyManager.toggleAiMode();
      callback(null, ""); // Don't forward the toggle command to the terminal
      return;
    }

    callback(null, chunk); // Forward all other inputs
  }
}

export class PtyManager {
  private ptyProcess: pty.IPty | null = null;
  private inputInterceptor!: InputInterceptor;
  private aiMode: boolean = false;
  private lastPrompt: string = "";
  private promptRegex = /(?:\r?\n|^)(.*?➜)/;

  constructor(private config: PtyManagerConfig) {
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

    this.inputInterceptor = new InputInterceptor(this);
    process.stdin.setRawMode(true);
    process.stdin.pipe(this.inputInterceptor).pipe(this.ptyProcess as any);

    this.ptyProcess.onData(this.handlePtyOutput.bind(this));

    process.stdout.on("resize", () => {
      this.ptyProcess?.resize(process.stdout.columns, process.stdout.rows);
    });
  }

  private makePrompt() {
    return ` [${
      this.aiMode ? this.config.aiModePrompt : this.config.defaultPrompt
    }]`;
  }

  private handlePtyOutput(data: string) {
    const prompt = this.makePrompt();

    // Look for a prompt pattern in the output
    const match = data.match(this.promptRegex);
    if (match) {
      // Store the most recent prompt including all ANSI codes
      this.lastPrompt = match[1];
    }

    // Modify the output to include our marker while preserving the original prompt
    const modifiedData = data.replace(
      /(.*?➜)(\s+[^➜\n]*?)(\s*)$/,
      (_, promptPart, middle, ending) =>
        `${promptPart}${prompt}${middle}${ending}`
    );

    process.stdout.write(modifiedData);
  }

  private getShell() {
    return process.platform === "win32"
      ? "powershell.exe"
      : process.platform === "darwin"
      ? "/bin/zsh"
      : process.env.SHELL || "bash";
  }

  public toggleAiMode() {
    this.aiMode = !this.aiMode;

    // Move cursor to beginning of line and clear it
    process.stdout.write("\r\x1b[K");

    // Use the last captured prompt if available, otherwise fall back to basic prompt
    const currentPrompt =
      this.lastPrompt || `${process.cwd().split("/").pop()} ➜`;
    process.stdout.write(`${currentPrompt}${this.makePrompt()} `);
  }

  public kill() {
    this.ptyProcess?.kill();
    this.ptyProcess = null;
  }
}
