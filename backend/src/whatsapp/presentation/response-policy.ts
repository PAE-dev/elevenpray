/** Política de presentación: nunca exponer IDs internos al usuario en WhatsApp. */
export function stripInternalIds<T extends Record<string, unknown>>(obj: T): T {
  const clone = { ...obj } as Record<string, unknown>;
  delete clone.id;
  delete clone.sourceWorkspaceId;
  delete clone.workspaceId;
  return clone as T;
}

export function sanitizeToolResult(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) =>
      typeof item === 'object' && item !== null
        ? sanitizeToolResult(item)
        : item,
    );
  }
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (key === 'id' || key.endsWith('Id') || key === 'sourceWorkspaceId') {
        continue;
      }
      out[key] =
        typeof value === 'object' && value !== null
          ? sanitizeToolResult(value)
          : value;
    }
    return out;
  }
  return data;
}
