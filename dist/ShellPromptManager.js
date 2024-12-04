export class ShellPromptManager {
    constructor(ptyProcess) {
        this.ptyProcess = ptyProcess;
        this.promptConfig = {
            terminalMode: "⚡",
            aiMode: "🤖",
            active: false,
            currentMode: "terminal",
        };
    }
    initialize() {
        const shellType = this.detectShellType();
        const initCommands = this.getInitCommands(shellType);
        // Execute initialization commands
        initCommands.forEach((cmd) => {
            this.ptyProcess.write(`${cmd}\n`);
        });
    }
    detectShellType() {
        const shell = process.env.SHELL || "";
        if (process.platform === "win32")
            return "powershell";
        return shell.includes("zsh") ? "zsh" : "bash";
    }
    getInitCommands(shellType) {
        const marker = '$(if [[ ${TOOL_ACTIVE} == 1 ]]; then echo "${TOOL_MODE_MARKER}"; fi)';
        switch (shellType) {
            case "zsh":
                return [
                    `export TOOL_ACTIVE=1`,
                    `export TOOL_MODE_MARKER="${this.promptConfig.terminalMode}"`,
                    `PROMPT='${marker}'$PROMPT`,
                ];
            case "bash":
                return [
                    `export TOOL_ACTIVE=1`,
                    `export TOOL_MODE_MARKER="${this.promptConfig.terminalMode}"`,
                    `PS1='${marker}'$PS1`,
                ];
            case "powershell":
                return [
                    `$env:TOOL_ACTIVE=1`,
                    `$env:TOOL_MODE_MARKER="${this.promptConfig.terminalMode}"`,
                    `function prompt { "$(if ($env:TOOL_ACTIVE -eq 1) { $env:TOOL_MODE_MARKER })$(Get-Location)> " }`,
                ];
            default:
                return [];
        }
    }
    toggleMode() {
        const newMode = this.promptConfig.currentMode === "terminal" ? "ai" : "terminal";
        const marker = newMode === "terminal"
            ? this.promptConfig.terminalMode
            : this.promptConfig.aiMode;
        const cmd = process.platform === "win32"
            ? `$env:TOOL_MODE_MARKER="${marker}"`
            : `export TOOL_MODE_MARKER="${marker}"`;
        this.ptyProcess.write(`${cmd}\n`);
        this.promptConfig.currentMode = newMode;
    }
    deactivate() {
        const cmd = process.platform === "win32"
            ? `$env:TOOL_ACTIVE=0`
            : `export TOOL_ACTIVE=0`;
        this.ptyProcess.write(`${cmd}\n`);
        this.promptConfig.active = false;
    }
}
