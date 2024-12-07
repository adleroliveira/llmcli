import { DebugLogger } from "../DebugLogger.js";
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
        DebugLogger.logRaw(event.content);
        // Enhanced cleaning function that preserves prompt structure
        const cleanContent = (str) => {
            return (str
                // Remove most ANSI escape sequences but preserve some terminal state changes
                .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "") // Standard ANSI
                .replace(/\x1B[\[\]()#;?].*?(?:[@-~]|\x07)/g, "") // Extended ANSI
                // Remove specific control sequences from your output
                .replace(/\x1B[=>]/g, "")
                .replace(/\x1B\[\?[0-9;]*[hl]/g, "")
                // Keep newlines and carriage returns for better prompt detection
                .replace(/[^\S\r\n]+/g, " ") // Replace multiple spaces with single space
                .trim());
        };
        // Get both cleaned and partially cleaned content for comparison
        const strippedContent = cleanContent(event.content);
        // More flexible prompt detection that handles your specific case
        const promptRegex = /(?:^|\r?\n).*?(?:bash|zsh|%|>|\$|#)\s*$/;
        const promptMatch = strippedContent.match(promptRegex);
        // DebugLogger.log("Prompt detection", {
        //   original: event.content,
        //   stripped: strippedContent,
        //   promptMatch: promptMatch ? promptMatch[0] : null,
        // });
        if (!promptMatch) {
            return { content: event.content };
        }
        // Initialize mode metadata on first prompt
        if (!context.metadata.isFirstPrompt) {
            context.metadata.isFirstPrompt = true;
            context.metadata.mode = "terminal";
        }
        const mode = context.metadata.mode || "terminal";
        const modeTag = ` [${mode}]`;
        // Find the last control sequence in the original content
        const lastControlSeq = event.content.match(/\x1B[^]*?$/);
        const insertPosition = lastControlSeq
            ? event.content.length - lastControlSeq[0].length
            : event.content.length;
        // Insert the mode tag before any trailing control sequences
        const modifiedContent = event.content.slice(0, insertPosition) +
            modeTag +
            event.content.slice(insertPosition);
        // DebugLogger.log("Prompt modification", {
        //   original: event.content,
        //   modified: modifiedContent,
        //   mode,
        //   insertPosition,
        //   hasControlSeq: !!lastControlSeq,
        // });
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
