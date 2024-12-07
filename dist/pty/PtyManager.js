import * as pty from "node-pty";
import { TerminalStreamProcessor, } from "./TerminalStreamProcessor.js";
export class PtyManager {
    constructor() {
        this.ptyProcess = null;
        this.processor = new TerminalStreamProcessor();
    }
    initialize() {
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
            .pipe(this.ptyProcess);
        this.ptyProcess.onData(this.processor.createOutputHandler((data) => {
            process.stdout.write(data);
        }));
        process.stdout.on("resize", () => {
            this.ptyProcess?.resize(process.stdout.columns, process.stdout.rows);
        });
    }
    getShell() {
        return process.platform === "win32"
            ? "powershell.exe"
            : process.platform === "darwin"
                ? "/bin/zsh"
                : process.env.SHELL || "bash";
    }
    use(middleware) {
        this.processor.use(middleware);
    }
    kill() {
        this.ptyProcess?.kill();
        this.ptyProcess = null;
    }
}
