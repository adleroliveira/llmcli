import { Transform } from "stream";
import { TerminalActionParser, } from "./TerminalActionParser.js";
export class PtyStreamProcessor extends Transform {
    constructor() {
        super();
        this.middlewares = [];
        this.buffer = "";
        this.context = {};
        this.parser = new TerminalActionParser();
        this.initializeEventHandlers();
    }
    addMiddleware(middleware) {
        this.middlewares.push(middleware);
    }
    removeMiddleware(middlewareId) {
        this.middlewares = this.middlewares.filter((m) => m.id !== middlewareId);
    }
    async processWithMiddlewares(event) {
        const terminalData = this.parser.parse(event.raw);
        let result = {
            content: event.content,
            event: {
                ...event,
                terminalData,
            },
        };
        const context = {
            buffer: this.buffer,
            metadata: {},
            parser: this.parser,
        };
        for (const middleware of this.middlewares) {
            if (middleware.events.includes(event.type)) {
                const middlewareResult = await middleware.transform({
                    ...result.event,
                    content: result.content || "",
                    terminalData: result.event?.terminalData,
                }, context);
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
                const currentTerminalData = result.event?.terminalData || terminalData;
                const updatedTerminalData = {
                    ...currentTerminalData,
                    ...(middlewareResult.terminalData || []),
                };
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
                        terminalData: updatedTerminalData,
                    },
                };
            }
        }
        return result;
    }
}
