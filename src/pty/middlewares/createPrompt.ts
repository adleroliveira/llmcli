import { Middleware } from "../PtyStreamProcessor";

export const createPromptMiddleware = (patterns: RegExp[]): Middleware => ({
  id: "prompt-detector",
  events: ["line"],
  transform: async (event, context) => {
    const cleanedContent = event.content.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

    for (const pattern of patterns) {
      const match = pattern.test(cleanedContent);
      if (match) {
        return {
          content: event.content,
          event: {
            type: "prompt",
            metadata: {
              promptText: cleanedContent,
              timestamp: Date.now(),
            },
          },
        };
      }
    }

    return { content: event.content };
  },
});
