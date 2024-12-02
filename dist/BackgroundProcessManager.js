import { spawn, execSync } from "child_process";
import EventEmitter from "events";
import * as os from "os";
export class BackgroundProcessManager extends EventEmitter {
    constructor() {
        super(...arguments);
        this.processes = new Set();
        this.isShuttingDown = false;
    }
    async spawn(command, args = []) {
        if (this.isShuttingDown) {
            throw new Error("Cannot spawn new processes during shutdown");
        }
        const childProcess = spawn(command, args, {
            cwd: process.cwd(),
            stdio: ["ignore", "ignore", "ignore"],
            detached: true,
        });
        this.processes.add(childProcess);
        childProcess.on("exit", () => {
            this.processes.delete(childProcess);
            this.emit("processExit", childProcess.pid);
        });
        return childProcess;
    }
    getChildPids(pid) {
        try {
            const output = execSync(`pgrep -P ${pid}`, {
                stdio: ["pipe", "pipe", "ignore"],
                encoding: "utf8",
            });
            return output.split("\n").filter(Boolean).map(Number);
        }
        catch (error) {
            return [];
        }
    }
    async killProcessTree(pid, forceKill = false) {
        try {
            const platform = os.platform();
            if (platform === "win32") {
                try {
                    execSync(`taskkill /pid ${pid} /T /F`);
                }
                catch (error) {
                    // Process might already be gone
                }
            }
            else {
                // Unix-like systems (Linux, macOS)
                const childPids = this.getChildPids(pid);
                // If forceKill is true, go straight to SIGKILL
                const signal = forceKill ? "SIGKILL" : "SIGTERM";
                // Kill children first
                for (const childPid of childPids) {
                    try {
                        process.kill(childPid, signal);
                    }
                    catch (e) {
                        // Process might already be gone
                    }
                }
                // Kill parent
                try {
                    process.kill(pid, signal);
                }
                catch (e) {
                    // Process might already be gone
                }
                // Only set up SIGKILL timeout if we're not already force killing
                if (!forceKill) {
                    setTimeout(() => {
                        for (const processId of [...childPids, pid]) {
                            try {
                                process.kill(processId, "SIGKILL");
                            }
                            catch (e) {
                                // Process might already be gone
                            }
                        }
                    }, 3000);
                }
            }
        }
        catch (error) {
            console.error(`Failed to kill process tree for PID ${pid}:`, error);
        }
    }
    async cleanup(timeout = 5000, forceKill = false) {
        if (this.isShuttingDown || this.processes.size === 0) {
            return;
        }
        this.isShuttingDown = true;
        const killPromises = Array.from(this.processes).map((proc) => new Promise((resolve) => {
            if (!proc.pid) {
                resolve();
                return;
            }
            this.killProcessTree(proc.pid, forceKill).finally(() => resolve());
        }));
        await Promise.race([
            Promise.all(killPromises),
            new Promise((resolve) => setTimeout(resolve, forceKill ? 1000 : timeout)),
        ]);
        this.processes.clear();
        this.isShuttingDown = false;
    }
    get activeProcessCount() {
        return this.processes.size;
    }
}
export const processManager = new BackgroundProcessManager();
