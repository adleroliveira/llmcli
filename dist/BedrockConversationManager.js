import { ConverseStreamCommand, } from "@aws-sdk/client-bedrock-runtime";
import EventEmitter from "events";
export class BedrockConversationManager extends EventEmitter {
    constructor(client, config, stateManager) {
        super();
        this.pendingToolUse = null;
        this.currentMessage = null;
        this.client = client;
        this.config = config;
        this.tools = new Map();
        this.stateManager = stateManager;
        this.activeConversations = new Map();
    }
    registerTool(name, tool) {
        this.tools.set(name, tool);
    }
    async processPendingToolUse() {
        if (!this.pendingToolUse || !this.currentMessage)
            return;
        const { sessionId, toolUseId, name, inputBuffer } = this.pendingToolUse;
        const tool = this.tools.get(name);
        let toolContent;
        try {
            let input = JSON.parse(inputBuffer || "{}");
            if (input.json) {
                input = input.json;
            }
            this.currentMessage.content.push({
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
            this.emit("toolResult", {
                sessionId,
                toolUseId,
                name,
                result: toolResult,
                status: "success",
            });
        }
        catch (error) {
            toolContent = {
                toolResult: {
                    toolUseId,
                    content: [
                        { text: error instanceof Error ? error.message : "Unknown error" },
                    ],
                    status: "error",
                },
            };
            this.emit("toolResult", {
                sessionId,
                toolUseId,
                name,
                result: error instanceof Error ? error.message : "Unknown error",
                status: "error",
            });
        }
        this.pendingToolUse = null;
        await this.interact(sessionId, [toolContent], { isToolResponse: true });
    }
    getToolResultContent(toolResult) {
        if (Array.isArray(toolResult))
            return { json: { result: toolResult } };
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
    createStreamHandler(sessionId, onDelta) {
        const handler = {
            messageStart: (value) => {
                this.currentMessage = {
                    role: "assistant",
                    content: [],
                };
                this.emit("messageStart", { sessionId, value });
            },
            contentBlockStart: (value) => {
                const toolUse = value.start?.toolUse;
                if (toolUse?.toolUseId && toolUse?.name) {
                    this.emit("toolUse", { sessionId, name: toolUse?.name });
                    this.pendingToolUse = {
                        sessionId,
                        toolUseId: toolUse.toolUseId,
                        name: toolUse.name,
                        inputBuffer: "",
                    };
                }
                this.emit("contentBlockStart", { sessionId, value });
            },
            contentBlockDelta: (value) => {
                if (this.pendingToolUse && value.delta?.toolUse?.input) {
                    this.pendingToolUse.inputBuffer += value.delta.toolUse.input;
                }
                else if (value.delta?.text && !this.pendingToolUse) {
                    const delta = value.delta.text;
                    onDelta?.(delta);
                    this.emit("delta", { sessionId, content: delta });
                    if (this.currentMessage &&
                        Array.isArray(this.currentMessage.content)) {
                        if (this.currentMessage.content.length === 0 ||
                            !("text" in
                                this.currentMessage.content[this.currentMessage.content.length - 1])) {
                            this.currentMessage.content.push({ text: "" });
                        }
                        const lastContent = this.currentMessage.content[this.currentMessage.content.length - 1];
                        if ("text" in lastContent) {
                            lastContent.text += delta;
                        }
                    }
                }
            },
            contentBlockStop: (value) => {
                this.emit("contentBlockStop", { sessionId, value });
            },
            messageStop: async (value) => {
                if (value.stopReason === "tool_use") {
                    await this.processPendingToolUse();
                }
                else if (this.currentMessage) {
                    await this.appendToConversation(sessionId, this.currentMessage);
                    this.emit("messageComplete", {
                        sessionId,
                        message: this.currentMessage,
                    });
                    this.currentMessage = null;
                }
            },
            metadata: (value) => {
                this.emit("metadata", { sessionId, value });
            },
            internalServerException: (value) => this.emit("error", { sessionId, error: value }),
            modelStreamErrorException: (value) => this.emit("error", { sessionId, error: value }),
            validationException: (value) => this.emit("error", { sessionId, error: value }),
            throttlingException: (value) => this.emit("error", { sessionId, error: value }),
            serviceUnavailableException: (value) => this.emit("error", { sessionId, error: value }),
            _: (name, value) => {
                this.emit("error", {
                    sessionId,
                    error: new Error(`Unknown event type: ${name}`),
                });
            },
        };
        return handler;
    }
    async getState(sessionId) {
        const state = await this.stateManager.load(sessionId);
        return (state || {
            messages: [],
            systemPrompts: { default: [{ text: "" }] },
        });
    }
    async appendToConversation(sessionId, message) {
        const state = await this.getState(sessionId);
        state.messages.push(message);
        await this.stateManager.save(sessionId, state);
    }
    getToolConfig() {
        if (this.tools.size === 0)
            return undefined;
        const toolSpecs = Array.from(this.tools.entries()).map(([_, tool]) => tool.spec());
        return {
            tools: toolSpecs,
            toolChoice: { auto: {} },
        };
    }
    async interact(sessionId, content, options = {}) {
        const previousInteraction = this.activeConversations.get(sessionId);
        const interaction = (async () => {
            if (previousInteraction)
                await previousInteraction;
            const state = await this.getState(sessionId);
            const lastMessage = state.messages[state.messages.length - 1];
            if (!options.isToolResponse && lastMessage?.role === "user") {
                throw new Error("Cannot send consecutive user messages. Wait for assistant response.");
            }
            const messageContent = typeof content === "string" ? [{ text: content }] : content;
            const message = {
                role: "user",
                content: messageContent,
            };
            const input = {
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
                            const handler = this.createStreamHandler(sessionId, options.onDelta);
                            const [eventType, eventValue] = Object.entries(event)[0];
                            handler[eventType]?.(eventValue);
                        }
                    }
                }
            }
            catch (error) {
                this.emit("error", { sessionId, error });
                throw error;
            }
        })();
        this.activeConversations.set(sessionId, interaction);
        await interaction;
        this.activeConversations.delete(sessionId);
    }
    async setSystemPrompt(sessionId, prompt, key = "default") {
        const state = await this.getState(sessionId);
        state.systemPrompts[key] = prompt;
        await this.stateManager.save(sessionId, state);
    }
}
