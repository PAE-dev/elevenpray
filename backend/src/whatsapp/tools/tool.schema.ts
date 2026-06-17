import { z } from 'zod';

/**
 * Convierte schemas Zod a JSON Schema compatible con MCP (Model Context Protocol).
 * Usa Zod 4 nativo — diseño listo para exponer tools vía MCP sin reescribir.
 */
export function zodToMcpJsonSchema(schema: z.ZodType, name: string): Record<string, unknown> {
  const inputSchema = z.toJSONSchema(schema);
  return {
    name,
    description: name,
    inputSchema,
  };
}

export function zodToOpenAiParameters(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  const { type, properties, required } = jsonSchema;
  return {
    type: type ?? 'object',
    properties: properties ?? {},
    required: required ?? [],
    additionalProperties: false,
  };
}
