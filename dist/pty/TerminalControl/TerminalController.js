import { EventEmitter } from "events";
import * as pty from "node-pty";
import { VT100Parser } from "./VT100Parser.js";
import { VT100Formatter } from "./VT100Formatter.js";
import { CSISequence } from "./CSISequence.js";
import { CursorStateManager } from "./CursorStateManager.js";
import { DebugLogger } from "./DebugLogger.js";
DebugLogger.initialize({
    logFile: "pty-debug.log",
    appendToFile: true,
    flushInterval: 2000, // 2 seconds
    maxBufferSize: 16384, // 16KB
});
export class TerminalController extends EventEmitter {
    constructor(config) {
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
    createInitialState() {
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
    async handleTerminalReady() {
        await this.setCursorPosition();
    }
    getShell() {
        return process.platform === "win32"
            ? "powershell.exe"
            : process.platform === "darwin"
                ? "/bin/zsh"
                : process.env.SHELL || "bash";
    }
    setupTerminal() {
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
        this.ptyProcess.onExit(({ exitCode }) => {
            DebugLogger.log("PTY Exit", { exitCode });
            process.exit(exitCode);
        });
        // Initialize viewport state
        this.state.viewport.width = cols;
        this.state.viewport.height = rows;
        this.state.viewport.scrollBottom = rows - 1;
        process.nextTick(() => this.emit("ready"));
    }
    handleInput(data) {
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
    handleOutput(data) {
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
    handleSequence(sequence) {
        // Update cursor state
        this.cursorStateManager.processSequence(sequence);
        // Emit sequence event for external handlers
        this.emit("sequence", sequence);
        return [sequence];
    }
    async sendSequenceWithResponse(sequence, responsePattern, timeout) {
        return new Promise((resolve, reject) => {
            const handler = {
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
    async setCursorPosition() {
        const dsr = CSISequence.from(new Uint8Array([0x1b, 0x5b, 0x36, 0x6e])); // ESC [ 6 n
        const response = await this.sendSequenceWithResponse(dsr, /\x1b\[(\d+);(\d+)R/);
        const y = parseInt(response[1], 10);
        const x = parseInt(response[2], 10);
        this.cursorStateManager.setPosition(x, y);
    }
}
