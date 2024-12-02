import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { ToolBuilder } from "../ToolBuilder.js";
// Tool to read file contents
export const createFileReadTool = () => {
    return new ToolBuilder("readFile")
        .describe("Reads and returns the contents of a file in the current directory")
        .input("filename", "string", "Name of the file to read (must be in current directory)", true)
        .handle(async ({ filename }) => {
        try {
            const filePath = join(process.cwd(), filename);
            const content = await readFile(filePath, "utf8");
            return {
                filename,
                content,
                success: true,
            };
        }
        catch (error) {
            throw new Error(`Failed to read file ${filename}: ${error.message}`);
        }
    });
};
// Tool to create/write to a file
export const createFileWriteTool = () => {
    return new ToolBuilder("writeFile")
        .describe("Creates a new file or overwrites an existing file in the current directory")
        .input("filename", "string", "Name of the file to create/write to", true)
        .input("content", "string", "Content to write to the file", true)
        .input("overwrite", "boolean", "Whether to overwrite if file exists (default false)", false)
        .handle(async ({ filename, content, overwrite = false }) => {
        try {
            const filePath = join(process.cwd(), filename);
            // Check if file exists before writing
            try {
                await readFile(filePath);
                if (!overwrite) {
                    throw new Error("File already exists and overwrite is set to false");
                }
            }
            catch (error) {
                // File doesn't exist, we can proceed
                if (error.code !== "ENOENT") {
                    throw error;
                }
            }
            await writeFile(filePath, content, "utf8");
            return {
                filename,
                success: true,
                message: `File ${filename} ${overwrite ? "overwritten" : "created"} successfully`,
                bytesWritten: Buffer.from(content).length,
            };
        }
        catch (error) {
            throw new Error(`Failed to write file ${filename}: ${error.message}`);
        }
    });
};
