import { BaseTerminalPanel } from "./BaseTerminalPanel.js";
import { Dimensions } from "./interfaces.js";
import * as pty from "node-pty";

export interface PTYPanelOptions {
  dimensions: Dimensions;
  shell?: string;
  name?: string;
  cwd?: string;
  env?: { [key: string]: string };
}

export class PTYPanel extends BaseTerminalPanel {
  private ptyProcess: pty.IPty;

  constructor(id: string, private options: PTYPanelOptions) {
    super(id, options.dimensions);
    const { cols, rows } = this.options.dimensions;
    this.ptyProcess = pty.spawn(this.options.shell || this.getShell(), [], {
      name: "xterm-color",
      cols: cols - 1,
      rows: rows - 1,
      cwd: this.options.cwd || process.cwd(),
      env: this.options.env || process.env,
    });

    this.ptyProcess.onData(this.processData.bind(this));

    this.ptyProcess.onExit(() => {
      this.clear();
      this.emit("exit");
    });

    this.on("resize", (dimensions: Dimensions) => {
      this.ptyProcess.resize(dimensions.cols, dimensions.rows);
    });
  }

  protected handleInput(data: string): void {
    this.ptyProcess.write(data);
  }

  private getShell() {
    return process.platform === "win32"
      ? "powershell.exe"
      : process.platform === "darwin"
      ? "/bin/zsh"
      : process.env.SHELL || "bash";
  }
}
