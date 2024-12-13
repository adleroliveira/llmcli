import { EventEmitter } from "events";
import * as pty from "node-pty";
import { VT100Parser } from "./VT100Parser.js";
import { VT100Formatter } from "./VT100Formatter.js";
import { CursorStateManager } from "./CursorStateManager.js";
import { ViewportStateManager } from "./ViewportStateManager.js";
import { CharsetStateManager } from "./CharsetStateManager.js";
import { ModeStateManager } from "./ModeStateManager.js";
import { PromptStateManager } from "./PromptStateManager.js";
import { LineBufferManager } from "./LineBufferManager.js";
import { DebugLogger } from "./DebugLogger.js";
DebugLogger.initialize({
    logFile: "pty-debug.log",
    appendToFile: true,
    flushInterval: 2000, // 2 seconds
    maxBufferSize: 16384, // 16KB
});
const DEFATUL_STREAM_ACTIVE_TIMEOUT = 500;
export class TerminalController extends EventEmitter {
    constructor(config) {
        super();
        this.streamActive = false;
        this.streamActiveTimer = null;
        this.viewportStateManager = new ViewportStateManager(this);
        this.cursorStateManager = new CursorStateManager(this);
        this.lineBufferManager = new LineBufferManager(this);
        this.charsetStateManager = new CharsetStateManager();
        this.modeStateManager = new ModeStateManager();
        this.promptStateManager = new PromptStateManager(this, "[⚡]");
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
    async handleTerminalReady() {
        await this.cursorStateManager.setup(this);
        this.on("streamActive", (status) => {
            if (!status)
                DebugLogger.log("State", this.getState());
        });
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
        // Initialize viewport state
        this.viewportStateManager.resize(cols, rows);
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
            this.viewportStateManager.resize(newCols, newRows);
            this.emit("resize", { cols: newCols, rows: newRows });
        });
        // Exit handling
        this.ptyProcess.onExit(({ exitCode }) => {
            DebugLogger.log("PTY Exit", { exitCode });
            process.exit(exitCode);
        });
        process.nextTick(() => this.emit("ready"));
    }
    handleInput(data) {
        this.setActiveStream();
        // Check for pending response handlers
        if (this.responseHandlers.length > 0) {
            this.responseBuffer += data.toString();
            // Try to match against all pending handlers
            for (let i = this.responseHandlers.length - 1; i >= 0; i--) {
                const handler = this.responseHandlers[i];
                const match = this.responseBuffer.match(handler.pattern);
                if (match) {
                    clearTimeout(handler.timer);
                    this.responseHandlers.splice(i, 1);
                    handler.resolve(match);
                    this.responseBuffer = this.responseBuffer.slice(match[0].length);
                    return;
                }
            }
        }
        // Forward unhandled input to PTY
        this.ptyProcess.write(data);
    }
    handleOutput(data) {
        this.setActiveStream();
        let outputStr = "";
        const sequences = this.parser.parseString(data);
        for (const sequence of sequences) {
            const handledSequence = this.handleSequence(sequence);
            DebugLogger.log("", VT100Formatter.format(handledSequence));
            outputStr += handledSequence.toString();
        }
        process.stdout.write(outputStr);
    }
    handleSequence(sequence, skipRecursion = false) {
        // Update all state managers except prompt
        this.charsetStateManager.processSequence(sequence);
        this.modeStateManager.processSequence(sequence);
        this.viewportStateManager.processSequence(sequence);
        this.cursorStateManager.processSequence(sequence);
        this.lineBufferManager.processSequence(sequence);
        // if (!skipRecursion) {
        //   const transformedSequence =
        //     this.promptStateManager.processSequence(sequence);
        //   if (transformedSequence !== sequence) {
        //     return this.handleSequence(transformedSequence, true);
        //   }
        // }
        return sequence;
    }
    sendSequence(sequence) {
        this.setActiveStream();
        process.stdout.write(sequence.toString());
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
    setActiveStream() {
        if (!this.streamActive) {
            this.streamActive = true;
            this.emit("streamActive", true);
        }
        if (this.streamActiveTimer)
            clearTimeout(this.streamActiveTimer);
        this.streamActiveTimer = setTimeout(() => {
            this.streamActive = false;
            this.emit("streamActive", false);
            this.streamActiveTimer = null;
        }, this.config.activeStreamTimeout || DEFATUL_STREAM_ACTIVE_TIMEOUT);
    }
    getState() {
        return {
            cursor: this.cursorStateManager.getState(),
            viewport: this.viewportStateManager.getState(),
            charset: this.charsetStateManager.getState(),
            mode: this.modeStateManager.getState(),
            lineBuffer: this.lineBufferManager.getState(),
        };
    }
    getViewPortStateManager() {
        return this.viewportStateManager;
    }
    getCursorStateManager() {
        return this.cursorStateManager;
    }
    getLineBufferManager() {
        return this.lineBufferManager;
    }
    getPromptStateManager() {
        return this.promptStateManager;
    }
}
