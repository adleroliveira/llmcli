import { Transform } from "stream";

export type StreamEvent = {
  type: "raw" | "line" | "command" | "prompt" | "error";
  content: string;
  raw: string;
  timestamp: number;
  metadata?: Record<string, any>;
};

export type MiddlewareContext = {
  buffer: string;
  metadata: Record<string, any>;
};

export type MiddlewareResult = {
  content: string | null;
  event?: Partial<StreamEvent>;
  buffer?: string;
  metadata?: Record<string, any>;
  preventDefault?: boolean;
};

export type Middleware = {
  id: string;
  events: StreamEvent["type"][];
  transform: (
    event: StreamEvent,
    context: MiddlewareContext
  ) => MiddlewareResult | Promise<MiddlewareResult>;
};

export abstract class PtyStreamProcessor extends Transform {
  protected middlewares: Middleware[] = [];
  protected buffer: string = "";
  protected context: Record<string, any> = {};

  constructor() {
    super();
    this.initializeEventHandlers();
  }

  protected abstract initializeEventHandlers(): void;

  public addMiddleware(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  public removeMiddleware(middlewareId: string): void {
    this.middlewares = this.middlewares.filter((m) => m.id !== middlewareId);
  }

  protected async processWithMiddlewares(
    event: StreamEvent
  ): Promise<MiddlewareResult> {
    let result: MiddlewareResult = {
      content: event.content,
      event,
    };

    const context: MiddlewareContext = {
      buffer: this.buffer,
      metadata: {},
    };

    for (const middleware of this.middlewares) {
      if (middleware.events.includes(event.type)) {
        const middlewareResult = await middleware.transform(
          { ...(result.event as StreamEvent), content: result.content || "" },
          context
        );

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
