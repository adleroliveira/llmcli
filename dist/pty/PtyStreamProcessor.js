import { Transform } from "stream";
export class PtyStreamProcessor extends Transform {
    constructor() {
        super();
        this.middlewares = [];
        this.buffer = "";
        this.context = {};
        this.initializeEventHandlers();
    }
    addMiddleware(middleware) {
        this.middlewares.push(middleware);
    }
    removeMiddleware(middlewareId) {
        this.middlewares = this.middlewares.filter((m) => m.id !== middlewareId);
    }
    async processWithMiddlewares(event) {
        let result = {
            content: event.content,
            event,
        };
        const context = {
            buffer: this.buffer,
            metadata: {},
        };
        for (const middleware of this.middlewares) {
            if (middleware.events.includes(event.type)) {
                const middlewareResult = await middleware.transform({ ...result.event, content: result.content || "" }, context);
                if (middlewareResult.preventDefault) {
                    return { content: null, preventDefault: true };
                }
                if (middlewareResult.buffer !== undefined) {
                    this.buffer = middlewareResult.buffer;
                    context.buffer = middlewareResult.buffer;
                }
                if (middlewareResult.metadata) {
                    context.metadata = {
                        ...context.metadata,
                        ...middlewareResult.metadata,
                    };
                }
                result = {
                    ...result,
                    ...middlewareResult,
                    event: {
                        ...result.event,
                        ...middlewareResult.event,
                        metadata: {
                            ...result.event?.metadata,
                            ...middlewareResult.event?.metadata,
                        },
                    },
                };
            }
        }
        return result;
    }
}
