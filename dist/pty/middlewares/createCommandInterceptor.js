export const createCommandInterceptorMiddleware = (pattern, handler) => ({
    id: "command-interceptor",
    events: ["command"],
    transform: async (event, context) => {
        if (pattern.test(event.content)) {
            const newCommand = await handler(event.content);
            return {
                content: newCommand,
                event: {
                    ...event,
                    content: newCommand,
                    metadata: {
                        intercepted: true,
                        originalCommand: event.content,
                    },
                },
            };
        }
        return { content: event.content };
    },
});
