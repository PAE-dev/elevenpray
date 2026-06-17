import { WhatsAppSlotManagerService } from './slot-manager.service';
import type { ToolRegistryEntry } from '../tools/tool.registry';
import { CreateTaskArgsSchema } from '../tools/tool.registry';

const createTaskTool: ToolRegistryEntry = {
  name: 'create_task',
  domain: 'tasks',
  intent: 'create_task',
  description: 'Crea tarea',
  argsSchema: CreateTaskArgsSchema,
  kind: 'write',
  requiresConfirmation: true,
  requiredSlots: ['title', 'course_name', 'deadline'],
  slotPrompts: {
    title: '¿Título?',
    course_name: '¿Curso?',
    deadline: '¿Fecha?',
  },
  execute: async () => ({ success: true, data: {} }),
  openAiParameters: {},
  mcpSchema: {},
};

describe('WhatsAppSlotManagerService (determinista)', () => {
  const manager = new WhatsAppSlotManagerService();

  it('pide slot faltante sin parsear lenguaje natural', () => {
    const result = manager.evaluate(
      createTaskTool,
      null,
      { title: 'Examen parcial' },
      'es del curso matematica1',
    );
    expect(result.action).toBe('ask');
    expect(result.missingSlot).toBe('course_name');
  });

  it('confirma cuando todos los slots son válidos', () => {
    const result = manager.evaluate(
      createTaskTool,
      null,
      {
        title: 'Examen parcial',
        course_name: 'Matematica 1',
        deadline: '2026-06-20',
      },
      'para el 20 de junio',
    );
    expect(result.action).toBe('confirm');
    expect(result.mergedSlots.title).toBe('Examen parcial');
    expect(result.mergedSlots.course_name).toBe('Matematica 1');
  });

  it('rechaza títulos basura como "es"', () => {
    const result = manager.evaluate(
      createTaskTool,
      null,
      { title: 'es', course_name: 'Matematica 1', deadline: '2026-06-20' },
      'la tarea es',
    );
    expect(result.action).toBe('ask');
    expect(result.missingSlot).toBe('title');
  });

  it('ejecuta tras confirmación sí', () => {
    const pending = {
      toolName: 'create_task',
      intent: 'create_task',
      slots: {
        title: 'Informe',
        course_name: 'Historia',
        deadline: '2026-06-25',
      },
      awaitingConfirmation: true,
    };
    const result = manager.evaluate(
      createTaskTool,
      pending,
      {},
      'sí',
    );
    expect(result.action).toBe('execute');
  });

  it('cancela tras confirmación no', () => {
    const pending = {
      toolName: 'create_task',
      intent: 'create_task',
      slots: {
        title: 'Informe',
        course_name: 'Historia',
        deadline: '2026-06-25',
      },
      awaitingConfirmation: true,
    };
    const result = manager.evaluate(
      createTaskTool,
      pending,
      {},
      'no',
    );
    expect(result.action).toBe('cancel');
  });
});
