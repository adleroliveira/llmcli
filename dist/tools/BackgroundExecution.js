import { processManager } from "../BackgroundProcessManager.js";
import { ToolBuilder } from "../ToolBuilder.js";
export const createBackgroundCommandTool = () => {
    return new ToolBuilder("executeBackgroundCommand")
        .describe("Executes a command in the background")
        .input("command", "string", "The command to execute", true)
        .input("args", "array", "Command arguments as array (optional)", false, {
        type: "string",
    })
        .handle(async ({ command, args = [] }) => {
        try {
            let finalCommand = command;
            let finalArgs = args;
            if (!args.length) {
                const parts = command.split(" ");
                finalCommand = parts[0];
                finalArgs = parts.slice(1);
            }
            const childProcess = await processManager.spawn(finalCommand, finalArgs);
            return {
                success: true,
                command: `${finalCommand} ${finalArgs.join(" ")}`,
                pid: childProcess.pid,
                message: `Background process started with PID ${childProcess.pid}`,
                activeProcesses: processManager.activeProcessCount,
            };
        }
        catch (error) {
            throw new Error(`Failed to start background command: ${error.message}`);
        }
    });
};
