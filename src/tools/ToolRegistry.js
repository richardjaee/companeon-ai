/**
 * ToolRegistry.js - Clean tool registration and execution
 * 
 * Tools are self-describing with:
 * - name: Unique identifier
 * - description: What the tool does (shown to LLM)
 * - parameters: JSON Schema for inputs
 * - handler: Async function to execute
 */

import { z } from 'zod';

/**
 * Convert Zod schema to JSON Schema for LLM tool calling
 */
function zodToJsonSchema(zodSchema) {
  // Handle z.object
  if (zodSchema._def?.typeName === 'ZodObject') {
    const shape = zodSchema._def.shape();
    const properties = {};
    const required = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      
      // Check if field is required (not optional)
      if (!value.isOptional?.()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  // Handle z.string
  if (zodSchema._def?.typeName === 'ZodString') {
    const schema = { type: 'string' };
    if (zodSchema._def.description) {
      schema.description = zodSchema._def.description;
    }
    return schema;
  }

  // Handle z.number
  if (zodSchema._def?.typeName === 'ZodNumber') {
    const schema = { type: 'number' };
    if (zodSchema._def.description) {
      schema.description = zodSchema._def.description;
    }
    return schema;
  }

  // Handle z.boolean
  if (zodSchema._def?.typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  // Handle z.array
  if (zodSchema._def?.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: zodToJsonSchema(zodSchema._def.type)
    };
  }

  // Handle z.enum
  if (zodSchema._def?.typeName === 'ZodEnum') {
    return {
      type: 'string',
      enum: zodSchema._def.values
    };
  }

  // Handle z.optional
  if (zodSchema._def?.typeName === 'ZodOptional') {
    return zodToJsonSchema(zodSchema._def.innerType);
  }

  // Handle z.default
  if (zodSchema._def?.typeName === 'ZodDefault') {
    const inner = zodToJsonSchema(zodSchema._def.innerType);
    inner.default = zodSchema._def.defaultValue();
    return inner;
  }

  // Handle described schemas
  if (zodSchema._def?.description) {
    const inner = zodToJsonSchema(zodSchema._def.innerType || zodSchema);
    inner.description = zodSchema._def.description;
    return inner;
  }

  // Fallback
  return { type: 'string' };
}

export class ToolRegistry {
  constructor({ logger }) {
    this.tools = new Map();
    this.logger = logger;
  }

  /**
   * Register a tool
   * @param {Object} tool
   * @param {string} tool.name - Unique tool identifier
   * @param {string} tool.description - What the tool does
   * @param {z.ZodSchema} tool.parameters - Zod schema for parameters
   * @param {Function} tool.handler - Async function(params, context) => result
   * @param {Array} tool.tags - Tags for filtering (free, paid, tx, x402, etc.)
   * @param {Object} tool.options - Additional options
   */
  register(tool) {
    const { name, description, parameters, handler, tags = [], ...options } = tool;

    if (!name || !description || !handler) {
      throw new Error(`Tool registration requires name, description, and handler`);
    }

    this.tools.set(name, {
      name,
      description,
      parameters: parameters || z.object({}),
      handler,
      tags,
      ...options
    });

    this.logger?.debug?.('tool_registered', { name, tags });
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools) {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get tool schemas for LLM (JSON Schema format)
   * @param {Object} options - Filter options
   * @param {string} options.x402Mode - 'off' | 'ask' | 'auto' - filters paid tools
   */
  getSchemas(options = {}) {
    const { x402Mode = 'off' } = options;
    const schemas = [];

    for (const [name, tool] of this.tools) {
      // Filter out paid tools if x402Mode is 'off'
      // Note: We include them but the LLM prompt tells it not to use them
      // This way the LLM knows they exist and can suggest enabling them
      
      schemas.push({
        name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
        tags: tool.tags || []
      });
    }

    return schemas;
  }

  /**
   * Get a tool by name
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name) {
    return this.tools.has(name);
  }

  /**
   * Execute a tool
   * @param {string} name - Tool name
   * @param {Object} args - Tool arguments
   * @param {Object} context - Execution context (wallet, chainId, etc.)
   */
  async execute(name, args, context = {}) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Validate arguments with Zod
    let validatedArgs;
    try {
      validatedArgs = tool.parameters.parse(args);
    } catch (validationError) {
      throw new Error(`Invalid arguments for ${name}: ${validationError.message}`);
    }

    // Execute the handler
    const startTime = Date.now();
    try {
      const result = await tool.handler(validatedArgs, context);
      
      this.logger?.info?.('tool_executed', {
        tool: name,
        durationMs: Date.now() - startTime
      });

      return result;

    } catch (execError) {
      this.logger?.error?.('tool_execution_failed', {
        tool: name,
        error: execError.message,
        durationMs: Date.now() - startTime
      });
      throw execError;
    }
  }

  /**
   * List all registered tools
   */
  list() {
    return Array.from(this.tools.keys());
  }
}

