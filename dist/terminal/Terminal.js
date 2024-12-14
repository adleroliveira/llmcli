import * as pty from "node-pty";
import { Window } from "./Window.js";
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_NAME = "xterm-color";
export class Terminal {
    constructor(config) {
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
    getShell() {
        return process.platform === "win32"
            ? "powershell.exe"
            : process.platform === "darwin"
                ? "/bin/zsh"
                : process.env.SHELL || "bash";
    }
    write(data) {
        this.ptyProcess.write(data);
    }
    stdoutHandler(data) {
        this.window.process(data);
    }
    exitHandler(e) {
        process.exit(e.exitCode);
    }
}
