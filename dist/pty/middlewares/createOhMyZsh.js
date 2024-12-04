export const createOhMyZshMiddleware = () => ({
    id: "oh-my-zsh-prompt",
    pattern: /(?:\r?\n|^)(.*?➜)(\s*$|\s+[^➜\n]*$)/,
    transform: async (chunk, context) => {
        const cleanedChunk = chunk.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
        if (this.pattern?.test(cleanedChunk)) {
            return {
                content: chunk,
                metadata: {
                    type: "prompt",
                    promptText: cleanedChunk,
                    shell: "oh-my-zsh",
                    timestamp: Date.now(),
                },
            };
        }
        return { content: chunk };
    },
});
