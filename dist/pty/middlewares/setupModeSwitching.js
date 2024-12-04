import { DebugLogger } from "../DebugLogger.js";
DebugLogger.initialize();
export const createModeToggleMiddleware = () => ({
    id: "mode-toggle",
    events: ["raw", "command"],
    transform: async (event, context) => {
        if (event.type === "raw" && event.content === "/" && !context.buffer) {
            const currentMode = context.metadata.mode || "terminal";
            const newMode = currentMode === "terminal" ? "ai" : "terminal";
            return {
                content: "",
                preventDefault: true,
                metadata: {
                    ...context.metadata,
                    mode: newMode,
                },
            };
        }
        return {
            content: event.content,
            metadata: context.metadata,
        };
    },
});
export const createPromptModifierMiddleware = () => ({
    id: "prompt-modifier",
    events: ["line"],
    transform: async (event, context) => {
        // Clean the content more thoroughly
        const cleanContent = (str) => {
            return (str
                // Remove ANSI escape sequences
                .replace(/\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]/g, "")
                .replace(/\x1B[@-Z\\-_]/g, "")
                // Remove control characters except prompt symbols
                .replace(/[\x00-\x1F\x7F-\x9F=]/g, "")
                // Replace multiple spaces with single space
                .replace(/\s+/g, " ")
                .trim());
        };
        const strippedContent = cleanContent(event.content);
        // Match common shell prompt endings
        const promptMatch = strippedContent.match(/[%$#>]\s*$/);
        DebugLogger.log("Prompt detection", {
            original: event.content,
            stripped: strippedContent,
            promptMatch: promptMatch ? promptMatch[0] : null,
        });
        if (!promptMatch) {
            return { content: event.content };
        }
        // For the first prompt, initialize mode metadata
        if (!context.metadata.isFirstPrompt) {
            context.metadata.isFirstPrompt = true;
            context.metadata.mode = "terminal";
        }
        const mode = context.metadata.mode || "terminal";
        const modeTag = `[${mode}]`;
        // Find the last occurrence of the prompt symbol in the original content
        const promptSymbol = promptMatch[0].trim();
        const lastPromptPos = event.content.lastIndexOf(promptSymbol);
        if (lastPromptPos === -1) {
            return { content: event.content };
        }
        // Insert the mode tag after the prompt
        const modifiedContent = event.content.slice(0, lastPromptPos + promptSymbol.length) +
            ` ${modeTag}` +
            event.content.slice(lastPromptPos + promptSymbol.length);
        DebugLogger.log("Prompt modification", {
            original: event.content,
            modified: modifiedContent,
            mode,
            promptSymbol,
            lastPromptPos,
        });
        return {
            content: modifiedContent,
            metadata: {
                ...context.metadata,
                mode,
                isPrompt: true,
            },
        };
    },
});
export const setupModeSwitching = (ptyManager) => {
    ptyManager.addInputMiddleware(createModeToggleMiddleware());
    ptyManager.addOutputMiddleware(createPromptModifierMiddleware());
};
