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
            // Normalize the output first
            let output = stderr ? `${stdout}\n${stderr}` : stdout;
            // Clean up the output consistently
            output = output
                // Convert Windows line endings
                .replace(/\r\n/g, "\n")
                // Remove any leading/trailing whitespace if trimming is enabled
                .split("\n")
                .map((line) => (trimOutput ? line.trim() : line))
                .join("\n")
                // Remove multiple consecutive empty lines
                .replace(/\n{3,}/g, "\n\n")
                // Ensure at most one trailing newline
                .replace(/\n+$/, "");
            return {
                success: true,
                command,
                output,
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
