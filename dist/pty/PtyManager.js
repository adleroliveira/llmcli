import * as pty from "node-pty";
import { InputProcessor } from "./InputProcessor.js";
import { OutputProcessor } from "./OutputProcessor.js";
export class PtyManager {
    constructor() {
        this.ptyProcess = null;
        this.inputProcessor = new InputProcessor();
        this.outputProcessor = new OutputProcessor();
        this.initialize();
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
        process.stdin.pipe(this.inputProcessor).pipe(this.ptyProcess);
        this.ptyProcess.onData((data) => {
            this.outputProcessor._transform(Buffer.from(data), "utf8", (error, transformedData) => {
                if (!error && transformedData) {
                    process.stdout.write(transformedData);
                }
            });
        });
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
    addInputMiddleware(middleware) {
        this.inputProcessor.addMiddleware(middleware);
    }
    addOutputMiddleware(middleware) {
        this.outputProcessor.addMiddleware(middleware);
    }
    removeMiddleware(middlewareId) {
        this.inputProcessor.removeMiddleware(middlewareId);
        this.outputProcessor.removeMiddleware(middlewareId);
    }
    kill() {
        this.ptyProcess?.kill();
        this.ptyProcess = null;
    }
}
