import { exec } from "child_process";
import { promisify } from "util";
import { ToolBuilder } from "../ToolBuilder.js";
const execAsync = promisify(exec);
export const createCommandExecutionTool = () => {
    return new ToolBuilder("executeCommand")
        .describe("Executes a shell command in the current directory")
        .input("command", "string", "The command to execute", true)
        .input("trimOutput", "boolean", "Whether to trim whitespace from the output (default true)", false)
        .handle(async ({ command, trimOutput = true }) => {
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: process.cwd(),
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            });
            // If there's stderr but the command didn't throw, it might be warnings
            // We'll include it in the response but mark success as true
            const output = stderr ? `${stdout}\n${stderr}` : stdout;
            return {
                success: true,
                command,
                output: trimOutput ? output.trim() : output,
                hasStderr: Boolean(stderr),
            };
        }
        catch (error) {
            // For command execution errors, we want to include the stderr in the error message
            const errorMessage = error.stderr || error.message;
            throw new Error(`Command execution failed: ${errorMessage}`);
        }
    });
};
