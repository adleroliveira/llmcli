export class ToolBuilder {
    constructor(name) {
        this.inputs = {};
        this.name = name;
    }
    describe(description) {
        this.description = description;
        return this;
    }
    input(name, type, description, required = true, items) {
        this.inputs[name] = { type, description, required };
        if (type === "array" && items) {
            this.inputs[name].items = items;
        }
        return this;
    }
    handle(handler) {
        if (this.description === undefined) {
            throw new Error("Tool description is required");
        }
        return {
            spec: () => ({
                toolSpec: {
                    name: this.name,
                    description: this.description,
                    inputSchema: {
                        json: {
                            type: "object",
                            properties: Object.entries(this.inputs).reduce((acc, [name, input]) => ({
                                ...acc,
                                [name]: {
                                    type: input.type,
                                    description: input.description,
                                    ...(input.type === "array" && input.items
                                        ? { items: input.items }
                                        : {}),
                                },
                            }), {}),
                            required: Object.entries(this.inputs)
                                .filter(([_, input]) => input.required)
                                .map(([name]) => name),
                        },
                    },
                },
            }),
            run: handler,
            name: this.name,
        };
    }
}
