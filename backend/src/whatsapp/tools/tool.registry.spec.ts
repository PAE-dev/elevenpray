import { createToolRegistry } from './tool.registry';

describe('WhatsApp tool registry', () => {
  const registry = createToolRegistry({
    listTasks: async () => ({ tasks: [] }),
    createTask: async () => ({ success: true }),
    getCourses: async () => ({ courses: [], total: 0, sourceWorkspaceId: null }),
    listCourses: async () => ({ courses: [] }),
    getCurriculum: async () => ({ courses: [] }),
    scheduleReminder: async () => ({ success: true }),
  });

  it('registra todas las tools del dominio académico', () => {
    expect(registry.has('list_tasks')).toBe(true);
    expect(registry.has('create_task')).toBe(true);
    expect(registry.has('get_courses')).toBe(true);
    expect(registry.has('get_curriculum')).toBe(true);
    expect(registry.has('schedule_reminder')).toBe(true);
  });

  it('marca tools de escritura con confirmación', () => {
    expect(registry.get('create_task')?.kind).toBe('write');
    expect(registry.get('create_task')?.requiresConfirmation).toBe(true);
    expect(registry.get('schedule_reminder')?.requiresConfirmation).toBe(true);
  });

  it('genera JSON Schema MCP-compatible', () => {
    const tool = registry.get('create_task')!;
    expect(tool.mcpSchema).toHaveProperty('inputSchema');
    expect(tool.openAiParameters).toHaveProperty('properties');
  });

  it('resuelve tool por intent', () => {
    const tool = [...registry.values()].find((t) => t.intent === 'get_tasks');
    expect(tool?.name).toBe('list_tasks');
  });
});
