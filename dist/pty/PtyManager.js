import * as pty from "node-pty";
export class PtyManager {
    constructor() {
        this.ptyProcess = null;
    }
    initialize() {
        const env = {
            ...process.env,
            BASH_SILENCE_DEPRECATION_WARNING: "1",
        };
        this.ptyProcess = pty.spawn(this.getShell(), [], {
            name: "xterm-256color",
            cols: process.stdout.columns,
            rows: process.stdout.rows,
            cwd: process.cwd(),
            encoding: null,
            env,
        });
        // this.processor = new TerminalController({
        //   process,
        //   ptyProcess: this.ptyProcess,
        // });
        // if (process.stdin.isTTY) {
        //   process.stdin.setRawMode(true);
        //   process.stdin.resume();
        // }
        // process.stdin
        //   .pipe(this.processor.createInputStream())
        //   .pipe(this.ptyProcess as any);
        // this.ptyProcess.onData(
        //   this.processor.createOutputHandler((data) => {
        //     process.stdout.write(data);
        //   })
        // );
        // process.stdout.on("resize", () => {
        //   this.ptyProcess?.resize(process.stdout.columns, process.stdout.rows);
        // });
    }
    getShell() {
        return process.platform === "win32"
            ? "powershell.exe"
            : process.platform === "darwin"
                ? "/bin/zsh"
                : process.env.SHELL || "bash";
    }
    use(middleware) {
        // this.processor.use(middleware);
    }
    kill() {
        this.ptyProcess?.kill();
        this.ptyProcess = null;
    }
}
