import { readdir } from "fs/promises";
import { stat } from "fs/promises";
import { join } from "path";
import { ToolBuilder } from "../ToolBuilder.js";
// Tool that prints files to screen
export const createDisplayDirectoryTool = () => {
    return new ToolBuilder("displayFiles")
        .describe("Displays files and directories in the current working directory to screen")
        .input("path", "string", "Relative path to list files from (defaults to current directory)", false)
        .input("showHidden", "boolean", "Whether to show hidden files (starting with .)", false)
        .handle(async ({ path = ".", showHidden = false }) => {
        try {
            const targetPath = join(process.cwd(), path);
            const entries = await readdir(targetPath);
            const fileList = await Promise.all(entries
                .filter((entry) => showHidden || !entry.startsWith("."))
                .map(async (entry) => {
                const fullPath = join(targetPath, entry);
                const stats = await stat(fullPath);
                return {
                    name: entry,
                    type: stats.isDirectory() ? "directory" : "file",
                    size: stats.size,
                    modifiedAt: stats.mtime.toISOString(),
                };
            }));
            // Print files to screen
            console.log(`\nContents of ${targetPath}:\n`);
            fileList.forEach((file) => {
                const sizeStr = file.type === "directory" ? "<DIR>" : `${file.size} bytes`;
                console.log(`${file.type === "directory" ? "📁" : "📄"} ${file.name.padEnd(30)} ${sizeStr.padEnd(15)} ${file.modifiedAt}`);
            });
            return {
                message: `Successfully displayed ${fileList.length} items from ${targetPath}`,
                itemsDisplayed: fileList.length,
            };
        }
        catch (error) {
            throw new Error(`Failed to display directory: ${error.message}`);
        }
    });
};
// Tool that returns file list to LLM
export const createFileListTool = () => {
    return new ToolBuilder("getFiles")
        .describe("Returns list of files and directories for LLM processing")
        .input("path", "string", "Relative path to list files from (defaults to current directory)", false)
        .input("showHidden", "boolean", "Whether to show hidden files (starting with .)", false)
        .handle(async ({ path = ".", showHidden = false }) => {
        try {
            const targetPath = join(process.cwd(), path);
            const entries = await readdir(targetPath);
            const fileList = await Promise.all(entries
                .filter((entry) => showHidden || !entry.startsWith("."))
                .map(async (entry) => {
                const fullPath = join(targetPath, entry);
                const stats = await stat(fullPath);
                return {
                    name: entry,
                    type: stats.isDirectory() ? "directory" : "file",
                    size: stats.size,
                    modifiedAt: stats.mtime.toISOString(),
                };
            }));
            return {
                currentPath: targetPath,
                files: fileList,
            };
        }
        catch (error) {
            throw new Error(`Failed to list directory: ${error.message}`);
        }
    });
};
