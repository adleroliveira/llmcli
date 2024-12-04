import { Middleware } from "../PtyStreamProcessor";

export const createModeToggleMiddleware = (trigger: string): Middleware => ({
  id: "mode-toggle",
  events: ["raw"],
  transform: async (event, context) => {
    if (event.content === trigger) {
      return {
        content: "", // Prevent the trigger from being sent to the terminal
        preventDefault: true,
        metadata: {
          mode: "toggled",
        },
      };
    }
    return { content: event.content };
  },
});
