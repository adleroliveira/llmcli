import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  Message,
  ContentBlock,
  SystemContentBlock,
  MessageStartEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  ContentBlockStopEvent,
  MessageStopEvent,
  ConverseStreamMetadataEvent,
  InternalServerException,
  ModelStreamErrorException,
  ValidationException,
  ThrottlingException,
  ServiceUnavailableException,
} from "@aws-sdk/client-bedrock-runtime";
import EventEmitter from "events";

interface ConversationState {
  messages: Message[];
  systemPrompts: Record<string, SystemContentBlock[]>;
}

export interface StreamEventHandler {
  messageStart: (value: MessageStartEvent) => void;
  contentBlockStart: (value: ContentBlockStartEvent) => void;
  contentBlockDelta: (value: ContentBlockDeltaEvent) => void;
  contentBlockStop: (value: ContentBlockStopEvent) => void;
  messageStop: (value: MessageStopEvent) => void;
  metadata: (value: ConverseStreamMetadataEvent) => void;
  internalServerException: (value: InternalServerException) => void;
  modelStreamErrorException: (value: ModelStreamErrorException) => void;
  validationException: (value: ValidationException) => void;
  throttlingException: (value: ThrottlingException) => void;
  serviceUnavailableException: (value: ServiceUnavailableException) => void;
  _: (name: string, value: unknown) => void;
}

interface Tool {
  spec(): {
    toolSpec: {
      name: string;
      description: string;
      inputSchema: {
        json: Record<string, any>;
      };
    };
  };
  run(input: any): Promise<any>;
}

interface ConversationConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

interface StateManager {
  save(sessionId: string, state: ConversationState): Promise<void>;
  load(sessionId: string): Promise<ConversationState | null>;
}

export class BedrockConversationManager extends EventEmitter {
  private client: BedrockRuntimeClient;
  private config: ConversationConfig;
  private tools: Map<string, Tool>;
  private stateManager: StateManager;
  private activeConversations: Map<string, Promise<void>>;

  private pendingToolUse: {
    sessionId: string;
    toolUseId: string;
    name: string;
    inputBuffer: string;
  } | null = null;
  private currentMessage: Message | null = null;

  constructor(
    client: BedrockRuntimeClient,
    config: ConversationConfig,
    stateManager: StateManager
  ) {
    super();
    this.client = client;
    this.config = config;
    this.tools = new Map();
    this.stateManager = stateManager;
    this.activeConversations = new Map();
  }

  registerTool(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }

  private async processPendingToolUse(): Promise<void> {
    if (!this.pendingToolUse || !this.currentMessage) return;
    const { sessionId, toolUseId, name, inputBuffer } = this.pendingToolUse;
    const tool = this.tools.get(name);

    let toolContent: ContentBlock;
    try {
      let input = JSON.parse(inputBuffer || "{}");
      if (input.json) {
        input = input.json;
      }

      this.currentMessage!.content!.push({
        toolUse: {
          toolUseId: toolUseId,
          name: name,
          input: { json: input },
        },
      });

      await this.appendToConversation(sessionId, this.currentMessage);
      this.currentMessage = null;

      // FIXME: if the inputBuffer fails to parse, the toolUse interaction will not be store in the conversation state
      // When the toolUse results (with the error) is sent to the LLM, it will fail, since it will not have detected
      // the toolUse interaction in the conversation state.

      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      const toolResult = await tool.run(input);
      toolContent = {
        toolResult: {
          toolUseId,
          content: [this.getToolResultContent(toolResult)],
          status: "success",
        },
      };
    } catch (error) {
      toolContent = {
        toolResult: {
          toolUseId,
          content: [
            { text: error instanceof Error ? error.message : "Unknown error" },
          ],
          status: "error",
        },
      };
    }

    this.pendingToolUse = null;
    await this.interact(sessionId, [toolContent], { isToolResponse: true });
  }

  private getToolResultContent(toolResult: any) {
    if (Array.isArray(toolResult)) return { json: { result: toolResult } };
    switch (typeof toolResult) {
      case "string":
        return { text: toolResult };
      case "object":
        return { json: toolResult };
      case "number":
      case "boolean":
      default:
        console.log("OH NO", toolResult);
        return { text: toolResult.toString() };
    }
  }

  private createStreamHandler(
    sessionId: string,
    onDelta?: (delta: string) => void
  ): StreamEventHandler {
    const handler: StreamEventHandler = {
      messageStart: (value: MessageStartEvent) => {
        this.currentMessage = {
          role: "assistant",
          content: [],
        };
        this.emit("messageStart", { sessionId, value });
      },

      contentBlockStart: (value: ContentBlockStartEvent) => {
        const toolUse = value.start?.toolUse;
        if (toolUse?.toolUseId && toolUse?.name) {
          this.pendingToolUse = {
            sessionId,
            toolUseId: toolUse.toolUseId,
            name: toolUse.name,
            inputBuffer: "",
          };
        }
        this.emit("contentBlockStart", { sessionId, value });
      },

      contentBlockDelta: (value: ContentBlockDeltaEvent) => {
        if (this.pendingToolUse && value.delta?.toolUse?.input) {
          this.pendingToolUse.inputBuffer += value.delta.toolUse.input;
        } else if (value.delta?.text && !this.pendingToolUse) {
          const delta = value.delta.text;
          onDelta?.(delta);
          this.emit("delta", { sessionId, content: delta });

          if (
            this.currentMessage &&
            Array.isArray(this.currentMessage.content)
          ) {
            if (
              this.currentMessage.content.length === 0 ||
              !(
                "text" in
                this.currentMessage.content[
                  this.currentMessage.content.length - 1
                ]
              )
            ) {
              this.currentMessage.content.push({ text: "" });
            }
            const lastContent =
              this.currentMessage.content[
                this.currentMessage.content.length - 1
              ];
            if ("text" in lastContent) {
              lastContent.text += delta;
            }
          }
        }
      },

      contentBlockStop: (value: ContentBlockStopEvent) => {
        this.emit("contentBlockStop", { sessionId, value });
      },

      messageStop: async (value: MessageStopEvent) => {
        if (value.stopReason === "tool_use") {
          await this.processPendingToolUse();
        } else if (this.currentMessage) {
          await this.appendToConversation(sessionId, this.currentMessage);
          this.emit("messageComplete", {
            sessionId,
            message: this.currentMessage,
          });
          this.currentMessage = null;
        }
      },

      metadata: (value: ConverseStreamMetadataEvent) => {
        this.emit("metadata", { sessionId, value });
      },

      internalServerException: (value: InternalServerException) =>
        this.emit("error", { sessionId, error: value }),
      modelStreamErrorException: (value: ModelStreamErrorException) =>
        this.emit("error", { sessionId, error: value }),
      validationException: (value: ValidationException) =>
        this.emit("error", { sessionId, error: value }),
      throttlingException: (value: ThrottlingException) =>
        this.emit("error", { sessionId, error: value }),
      serviceUnavailableException: (value: ServiceUnavailableException) =>
        this.emit("error", { sessionId, error: value }),

      _: (name: string, value: unknown) => {
        this.emit("error", {
          sessionId,
          error: new Error(`Unknown event type: ${name}`),
        });
      },
    };

    return handler;
  }

  private async getState(sessionId: string): Promise<ConversationState> {
    const state = await this.stateManager.load(sessionId);
    return (
      state || {
        messages: [],
        systemPrompts: { default: [{ text: "" }] },
      }
    );
  }

  private async appendToConversation(
    sessionId: string,
    message: Message
  ): Promise<void> {
    const state = await this.getState(sessionId);
    state.messages.push(message);
    await this.stateManager.save(sessionId, state);
  }

  private getToolConfig() {
    if (this.tools.size === 0) return undefined;

    const toolSpecs = Array.from(this.tools.entries()).map(([_, tool]) =>
      tool.spec()
    );

    return {
      tools: toolSpecs,
      toolChoice: { auto: {} },
    };
  }

  async interact(
    sessionId: string,
    content: ContentBlock[] | string,
    options: {
      systemPromptKey?: string;
      onDelta?: (delta: string) => void;
      isToolResponse?: boolean;
    } = {}
  ): Promise<void> {
    const previousInteraction = this.activeConversations.get(sessionId);
    const interaction = (async () => {
      if (previousInteraction) await previousInteraction;

      const state = await this.getState(sessionId);
      const lastMessage = state.messages[state.messages.length - 1];

      if (!options.isToolResponse && lastMessage?.role === "user") {
        throw new Error(
          "Cannot send consecutive user messages. Wait for assistant response."
        );
      }

      const messageContent: ContentBlock[] =
        typeof content === "string" ? [{ text: content }] : content;

      const message: Message = {
        role: "user",
        content: messageContent,
      };

      const input: ConverseStreamCommandInput = {
        modelId: this.config.modelId,
        messages: [...state.messages, message],
        system: state.systemPrompts[options.systemPromptKey || "default"] || [
          { text: "" },
        ],
        inferenceConfig: {
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
          topP: this.config.topP,
          stopSequences: this.config.stopSequences,
        },
        toolConfig: this.getToolConfig(),
      };

      try {
        await this.appendToConversation(sessionId, message);
        const command = new ConverseStreamCommand(input);
        const response = await this.client.send(command);

        if (response.stream) {
          for await (const event of response.stream) {
            if (event) {
              const handler = this.createStreamHandler(
                sessionId,
                options.onDelta
              );
              const [eventType, eventValue] = Object.entries(event)[0];
              (handler as any)[eventType]?.(eventValue);
            }
          }
        }
      } catch (error) {
        this.emit("error", { sessionId, error });
        throw error;
      }
    })();

    this.activeConversations.set(sessionId, interaction);
    await interaction;
    this.activeConversations.delete(sessionId);
  }

  async setSystemPrompt(
    sessionId: string,
    prompt: SystemContentBlock[],
    key = "default"
  ): Promise<void> {
    const state = await this.getState(sessionId);
    state.systemPrompts[key] = prompt;
    await this.stateManager.save(sessionId, state);
  }
}
