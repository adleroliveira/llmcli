import { BedrockClient, ListFoundationModelsCommand, } from "@aws-sdk/client-bedrock";
import { BedrockRuntimeClient, ConverseStreamCommand, } from "@aws-sdk/client-bedrock-runtime";
import chalk from "chalk";
import inquirer from "inquirer";
export class BedrockManager {
    constructor(config, credentials) {
        this.SUPPORTED_MODELS = [
            // AI21 Labs models
            "ai21.jamba-1-5-large-v1:0", // Jamba 1.5 Large
            "ai21.jamba-1-5-mini-v1:0", // Jamba 1.5 Mini
            // Anthropic Claude models
            "anthropic.claude-3-opus-20240229-v1:0", // Claude 3
            "anthropic.claude-3-sonnet-20240229-v1:0", // Claude 3 Sonnet
            "anthropic.claude-3-5-sonnet-20241022-v2:0", // Claude 3 Sonnet v2
            "anthropic.claude-3-haiku-20240307-v1:0", // Claude 3 Haiku
            "anthropic.claude-3-5-haiku-20241022-v1:0", // Claude Haiku 3.5
            // Cohere models
            "cohere.command-r-v1:0", // Command R
            "cohere.command-r-plus-v1:0", // Command R+
        ];
        this.config = config;
        this.credentials = credentials;
    }
    createClients() {
        const runtimeClient = new BedrockRuntimeClient({
            region: this.config.awsRegion,
            credentials: this.credentials,
        });
        const bedrockClient = new BedrockClient({
            region: this.config.awsRegion,
            credentials: this.credentials,
        });
        return { runtimeClient, bedrockClient };
    }
    async checkConverseAccess(modelId) {
        const { runtimeClient } = this.createClients();
        try {
            const command = new ConverseStreamCommand({
                modelId,
                messages: [
                    {
                        role: "user",
                        content: [{ text: "test" }],
                    },
                ],
                system: [{ text: "test" }],
            });
            await runtimeClient.send(command);
            return true;
        }
        catch (error) {
            if (error.name === "ValidationException") {
                return false;
            }
            if (error.name === "AccessDeniedException") {
                return false;
            }
            throw error;
        }
        finally {
            // Destroy the client after use
            runtimeClient.destroy();
        }
    }
    formatModelName(modelId) {
        const modelMappings = {
            "ai21.j2-large-v1": "AI21 Labs Jamba 1.5 Large",
            "ai21.j2-mini-v1": "AI21 Labs Jamba 1.5 Mini",
            "anthropic.claude-3": "Anthropic Claude 3",
            "anthropic.claude-3-sonnet": "Anthropic Claude 3 Sonnet",
            "anthropic.claude-3-sonnet-v2": "Anthropic Claude 3.5 Sonnet v2",
            "anthropic.claude-3-haiku": "Anthropic Claude 3 Haiku",
            "cohere.command-r": "Cohere Command R",
            "cohere.command-r-plus": "Cohere Command R+",
        };
        return modelMappings[modelId] || modelId;
    }
    async getAvailableModels() {
        const { bedrockClient } = this.createClients();
        try {
            const command = new ListFoundationModelsCommand({});
            const response = await bedrockClient.send(command);
            return (response.modelSummaries
                ?.filter((model) => {
                const modelId = model.modelId || "";
                return this.SUPPORTED_MODELS.includes(modelId);
            })
                .map((model) => model.modelId) ?? []);
        }
        catch (error) {
            console.error(chalk.red("Error fetching available models:"));
            console.error(error);
            return [];
        }
        finally {
            // Destroy the client after use
            bedrockClient.destroy();
        }
    }
    async setupBedrockConfig() {
        console.log(chalk.blue("\nSetting up Amazon Bedrock configuration... 🚀"));
        // First check if we have general Bedrock access
        try {
            await this.getAvailableModels();
        }
        catch (error) {
            if (error.name === "AccessDeniedException") {
                console.log(chalk.red("\n❌ No access to Amazon Bedrock."));
                console.log(chalk.yellow("\nTo request access:"));
                console.log("1. Go to the AWS Console");
                console.log("2. Navigate to Amazon Bedrock");
                console.log("3. Click 'Model access' in the left navigation");
                console.log("4. Request access to the models you want to use");
                console.log("\nOnce you have access, run the configuration again.");
                process.exit(1);
            }
            throw error;
        }
        // Get available models
        const availableModels = await this.getAvailableModels();
        if (availableModels.length === 0) {
            console.log(chalk.red("\n❌ No compatible models found in this region."));
            console.log(chalk.yellow("\nPlease try:"));
            console.log("1. Checking if you're in the correct region");
            console.log("2. Verifying you have requested model access");
            console.log("3. Ensuring the region supports the models you need");
            process.exit(1);
        }
        // Let user select a model
        const { modelId } = await inquirer.prompt([
            {
                type: "list",
                name: "modelId",
                message: "Which model would you like to use? (Recommended: Anthropic Haiku 3.5)",
                choices: availableModels.map((id) => ({
                    name: this.formatModelName(id),
                    value: id,
                })),
            },
        ]);
        // Check access to selected model
        const hasAccess = await this.checkConverseAccess(modelId);
        if (!hasAccess) {
            console.log(chalk.red(`\n❌ No access to model: ${this.formatModelName(modelId)}`));
            console.log(chalk.yellow("\nTo request access:"));
            console.log("1. Go to the AWS Console");
            console.log("2. Navigate to Amazon Bedrock");
            console.log("3. Click 'Model access' in the left navigation");
            console.log(`4. Request access to ${this.formatModelName(modelId)}`);
            console.log("\nOnce you have access, run the configuration again.");
            process.exit(1);
        }
        // Store the selected model in config
        this.config.bedrock = {
            modelId,
        };
        console.log(chalk.green(`\n✅ Successfully configured Bedrock with model: ${this.formatModelName(modelId)}`));
    }
    async validateModelAccess() {
        try {
            // First check if we can list models
            const availableModels = await this.getAvailableModels();
            if (!availableModels.includes(this.config.bedrock?.modelId)) {
                return false;
            }
            // Then check if we can actually invoke the model
            return await this.checkConverseAccess(this.config.bedrock?.modelId);
        }
        catch (error) {
            console.error("Error validating model access:", error);
            return false;
        }
    }
}
