import { ToolBuilder, ToolInput } from "./ToolBuilder";
import yaml from "js-yaml";
import fs from "fs/promises";
import axios from "axios";

interface OpenAPIParameter {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema: {
    type: string;
    format?: string;
    $ref?: string;
  };
}

interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  description?: string;
  $ref?: string;
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    content: {
      "application/json"?: {
        schema: OpenAPISchema;
      };
    };
  };
}

interface OpenAPIPath {
  [method: string]: OpenAPIOperation;
}

interface OpenAPISpec {
  servers?: { url: string }[];
  paths: Record<string, OpenAPIPath>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
  };
}

function resolveReference(ref: string, spec: OpenAPISpec): OpenAPISchema {
  // Handle local references (starting with #)
  if (ref.startsWith("#/")) {
    const parts = ref.split("/").slice(1); // Remove the '#' part
    let current: any = spec;

    for (const part of parts) {
      if (!current[part]) {
        throw new Error(`Invalid reference: ${ref}`);
      }
      current = current[part];
    }

    return current;
  }

  throw new Error(`External references not supported: ${ref}`);
}

function resolveSchema(
  schema: OpenAPISchema,
  spec: OpenAPISpec
): OpenAPISchema {
  if (schema.$ref) {
    return resolveReference(schema.$ref, spec);
  }

  // Deep clone the schema to avoid modifying the original
  const resolvedSchema: OpenAPISchema = { ...schema };

  // Recursively resolve references in properties
  if (resolvedSchema.properties) {
    resolvedSchema.properties = Object.entries(
      resolvedSchema.properties
    ).reduce(
      (acc, [key, propSchema]) => ({
        ...acc,
        [key]: resolveSchema(propSchema, spec),
      }),
      {}
    );
  }

  return resolvedSchema;
}

async function fetchSpecification(specLocation: string): Promise<OpenAPISpec> {
  try {
    const url = new URL(specLocation);
    const response = await axios.get(url.toString());
    return typeof response.data === "string"
      ? (yaml.load(response.data) as OpenAPISpec)
      : response.data;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ERR_INVALID_URL"
    ) {
      const content = await fs.readFile(specLocation, "utf-8");
      return yaml.load(content) as OpenAPISpec;
    }
    throw error;
  }
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function inferBaseUrl(spec: OpenAPISpec, specLocation: string): string {
  // Try to get base URL from spec servers
  let baseURL = spec.servers?.[0]?.url;

  // If baseURL is just a path or not present
  if (!baseURL || !isValidUrl(baseURL)) {
    if (specLocation.startsWith("http")) {
      const specUrl = new URL(specLocation);
      if (!baseURL) {
        // If no baseURL provided, use the spec location origin
        baseURL = specUrl.origin;
      } else {
        // If baseURL is a path, combine it with the spec location origin
        baseURL = new URL(baseURL, specUrl.origin).toString();
      }
    } else {
      throw new Error(
        "Could not determine base URL. When using a local spec file, the server URL must be absolute"
      );
    }
  }

  // Remove trailing slash if present
  return baseURL.replace(/\/$/, "");
}

function joinUrls(...parts: string[]): string {
  // Remove leading/trailing slashes from intermediate parts
  const cleanParts = parts.map((part, index) => {
    if (index === 0) return part.replace(/\/+$/, ""); // Remove trailing slashes from first part
    if (index === parts.length - 1) return part.replace(/^\/+/, ""); // Remove leading slashes from last part
    return part.replace(/^\/+|\/+$/g, ""); // Remove both for intermediate parts
  });

  return cleanParts.join("/");
}

function generateOperationId(method: string, path: string): string {
  // Convert path parameters to camelCase names
  const pathWithoutParams = path
    .replace(/\{([^}]+)\}/g, (_, param) => param)
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim();

  // Convert to camelCase
  const parts = pathWithoutParams.split(" ").filter(Boolean);
  const camelCasePath = parts
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");

  return `${method.toLowerCase()}${camelCasePath
    .charAt(0)
    .toUpperCase()}${camelCasePath.slice(1)}`;
}

export async function createToolsFromOpenAPI(specLocation: string) {
  const spec = await fetchSpecification(specLocation);
  const baseURL = inferBaseUrl(spec, specLocation);

  if (!baseURL) {
    throw new Error("Could not determine base URL from spec or spec location");
  }

  console.log("Base URL:", baseURL);

  const tools = [];

  // Process each path and method
  for (const [specPath, pathObj] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathObj)) {
      if (
        !operation ||
        typeof operation !== "object" ||
        method === "parameters"
      ) {
        continue;
      }

      // Generate operationId if not provided
      const operationId =
        operation.operationId || generateOperationId(method, specPath);

      // Create tool using ToolBuilder
      const tool = new ToolBuilder(operationId).describe(
        operation.description ||
          operation.summary ||
          `${method.toUpperCase()} ${specPath}`
      );

      // Add parameters as inputs
      const params = operation.parameters || [];
      for (const param of params) {
        const resolvedSchema = param.schema.$ref
          ? resolveSchema(param.schema, spec)
          : param.schema;

        const type = mapOpenAPITypeToToolType(resolvedSchema.type || "string");
        if (type) {
          tool.input(param.name, type, param.description, param.required);
        }
      }

      // Add request body properties as inputs if present
      const requestBodySchema =
        operation.requestBody?.content["application/json"]?.schema;
      if (requestBodySchema) {
        const resolvedSchema = resolveSchema(requestBodySchema, spec);

        if (resolvedSchema.properties) {
          // Get the list of required fields
          const requiredFields = resolvedSchema.required || [];

          // Process each property in the schema
          for (const [name, propSchema] of Object.entries(
            resolvedSchema.properties
          )) {
            const resolvedPropSchema = propSchema.$ref
              ? resolveSchema(propSchema, spec)
              : propSchema;

            const type = mapOpenAPITypeToToolType(
              resolvedPropSchema.type || "string"
            );
            if (type) {
              const required = requiredFields.includes(name);
              tool.input(name, type, resolvedPropSchema.description, required);
            }
          }
        }
      }

      // Create handler function
      const finalTool = tool.handle(async (input: Record<string, any>) => {
        // Prepare URL with path parameters
        let urlPath = specPath;
        const queryParams: Record<string, string> = {};
        const pathParams: Record<string, string> = {};
        const bodyParams: Record<string, any> = {};

        // Process parameters
        for (const param of params) {
          const value = input[param.name];
          if (value !== undefined) {
            if (param.in === "query") {
              queryParams[param.name] = String(value);
            } else if (param.in === "path") {
              pathParams[param.name] = String(value);
            }
          }
        }

        // Handle path parameters
        for (const [name, value] of Object.entries(pathParams)) {
          urlPath = urlPath.replace(`{${name}}`, value);
        }

        // Handle request body
        if (requestBodySchema) {
          const resolvedSchema = resolveSchema(requestBodySchema, spec);
          if (resolvedSchema.properties) {
            for (const key of Object.keys(resolvedSchema.properties)) {
              if (input[key] !== undefined) {
                bodyParams[key] = input[key];
              }
            }
          }
        }

        const finalUrl = joinUrls(baseURL, urlPath);

        // Make API call
        try {
          console.log("Making API call to:", finalUrl);
          console.log("Method:", method);
          console.log("Query params:", queryParams);
          console.log("Body:", bodyParams);

          const response = await axios({
            method,
            url: finalUrl,
            params: queryParams,
            data: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });

          return response.data;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.error(
              "API call failed:",
              error.response?.data || error.message
            );
            throw new Error(`API call failed: ${error.message}`);
          }
          throw error;
        }
      });

      tools.push(finalTool);
    }
  }

  return tools;
}

function mapOpenAPITypeToToolType(
  openAPIType: string
): ToolInput["type"] | null {
  const typeMap: Record<string, ToolInput["type"]> = {
    string: "string",
    number: "number",
    integer: "number",
    boolean: "boolean",
    object: "object",
  };
  return typeMap[openAPIType] || null;
}
