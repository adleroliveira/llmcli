import {
  BedrockRuntimeClient,
  SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockConversationManager,
  ToolResult,
} from "./BedrockConversationManager.js";
import { AwsCredentials } from "./ConfigManager";

export interface StateManager {
  save(sessionId: string, state: any): Promise<void>;
  load(sessionId: string): Promise<any>;
}

export class InMemoryStateManager implements StateManager {
  private storage = new Map<string, any>();

  async save(sessionId: string, state: any): Promise<void> {
    this.storage.set(sessionId, state);
  }

  async load(sessionId: string): Promise<any> {
    return this.storage.get(sessionId) || null;
  }
}

export interface Tool {
  spec(): any;
  run(input: any): Promise<any>;
  name: string;
}

interface AgentConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  region?: string;
  stateManager?: StateManager;
  credentials: AwsCredentials;
}

interface ConversationOptions {
  systemPrompt?: SystemContentBlock[];
  onMessage?: (message: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onToolResult?: (result: ToolResult) => void;
}

export class BedrockAgent {
  private manager: BedrockConversationManager;
  private tools: Map<string, Tool>;
  private activeConversations: Set<string>;
  private conversationHandlers: Map<string, ConversationOptions>;

  constructor(config: AgentConfig) {
    const client = new BedrockRuntimeClient({
      region: config.region || "us-east-1",
      credentials: config.credentials,
    });
    const stateManager = config.stateManager || new InMemoryStateManager();

    this.tools = new Map();
    this.activeConversations = new Set();
    this.conversationHandlers = new Map();

    this.manager = new BedrockConversationManager(
      client,
      {
        modelId: config.modelId,
        maxTokens: config.maxTokens || 2048,
        temperature: config.temperature || 0.7,
        topP: config.topP,
        stopSequences: config.stopSequences,
      },
      stateManager
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.manager.on("delta", ({ sessionId, content }) => {
      const handlers = this.conversationHandlers.get(sessionId);
      if (handlers?.onMessage) {
        handlers.onMessage(content);
      } else {
        console.warn(`[Agent] No message handler for session ${sessionId}`);
      }
    });

    this.manager.on("messageComplete", ({ sessionId }) => {
      const handlers = this.conversationHandlers.get(sessionId);
      if (handlers?.onComplete) {
        handlers.onComplete();
      } else {
        console.warn(`[Agent] No complete handler for session ${sessionId}`);
      }
      this.activeConversations.delete(sessionId);
    });

    this.manager.on("error", ({ sessionId, error }) => {
      const handlers = this.conversationHandlers.get(sessionId);
      if (handlers?.onError) {
        handlers.onError(error);
      }
      this.activeConversations.delete(sessionId);
    });

    this.manager.on("toolResult", (result) => {
      const handlers = this.conversationHandlers.get(result.sessionId);
      if (handlers?.onToolResult) {
        handlers.onToolResult(result);
      }
    });
  }

  async registerTool(tool: Tool): Promise<void> {
    this.tools.set(tool.name, tool);
    this.manager.registerTool(tool.name, tool);
  }

  async createConversation(
    sessionId: string,
    options: ConversationOptions = {}
  ): Promise<void> {
    // Store handlers for this conversation
    this.conversationHandlers.set(sessionId, options);

    // Set system prompt if provided
    if (options.systemPrompt) {
      await this.manager.setSystemPrompt(sessionId, options.systemPrompt);
    }
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    try {
      this.activeConversations.add(sessionId);
      await this.manager.interact(sessionId, message);

      if (this.activeConversations.has(sessionId)) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error(`[Agent] Timeout for session ${sessionId}`);
            this.activeConversations.delete(sessionId);
            reject(new Error("Message timeout after 2 minutes"));
          }, 120000);

          const checkComplete = () => {
            if (!this.activeConversations.has(sessionId)) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(checkComplete, 100);
            }
          };
          checkComplete();
        });
      }
    } catch (error) {
      this.activeConversations.delete(sessionId);
      throw error;
    }
  }

  async isConversationActive(sessionId: string): Promise<boolean> {
    return this.activeConversations.has(sessionId);
  }

  // Clean up method to remove handlers when conversation is done
  async cleanupConversation(sessionId: string): Promise<void> {
    this.conversationHandlers.delete(sessionId);
    this.activeConversations.delete(sessionId);
  }
}
