/**
 * Evals multi-turno (precisión conversacional, no solo single-turn).
 * Simulan extracción LLM + validación determinista del slot manager.
 * Ejecutar: npm test -- whatsapp-multiturn.eval
 */
import { WhatsAppSlotManagerService } from '../slots/slot-manager.service';
import type { ToolRegistryEntry } from '../tools/tool.registry';
import { z } from 'zod';

describe('WhatsApp multi-turn evals', () => {
  const slotManager = new WhatsAppSlotManagerService();

  const scheduleTool: ToolRegistryEntry = {
    name: 'schedule_reminder',
    domain: 'reminders',
    intent: 'schedule_reminder',
    description: 'test',
    argsSchema: z.object({
      title: z.string().min(1),
      remind_at: z.string().min(1),
    }),
    kind: 'write',
    requiresConfirmation: true,
    requiredSlots: ['title', 'remind_at'],
    slotPrompts: {
      title: '¿De qué?',
      remind_at: '¿Cuándo?',
    },
    execute: async () => ({}),
    openAiParameters: {},
    mcpSchema: {},
  };

  it('eval: completitud de schedule_reminder en 3 turnos', () => {
    const turn1 = slotManager.evaluate(
      scheduleTool,
      null,
      { title: 'Estudiar' },
      'recuérdame estudiar',
    );
    expect(turn1.action).toBe('ask');
    expect(turn1.missingSlot).toBe('remind_at');

    const turn2 = slotManager.evaluate(
      scheduleTool,
      {
        toolName: 'schedule_reminder',
        intent: 'schedule_reminder',
        slots: { title: 'Estudiar' },
        awaitingConfirmation: false,
        awaitingSlot: 'remind_at',
      },
      { remind_at: '2026-06-17T09:00' },
      'mañana a las 9am',
    );
    expect(turn2.mergedSlots.remind_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(turn2.action).toBe('confirm');

    const turn3 = slotManager.evaluate(
      scheduleTool,
      {
        toolName: 'schedule_reminder',
        intent: 'schedule_reminder',
        slots: turn2.mergedSlots,
        awaitingConfirmation: true,
      },
      {},
      'sí',
    );
    expect(turn3.action).toBe('execute');
  });

  it('corrige slots durante confirmación inválida con extracción LLM simulada', () => {
    const createTaskTool: ToolRegistryEntry = {
      name: 'create_task',
      domain: 'tasks',
      intent: 'create_task',
      description: 'test',
      argsSchema: z.object({
        title: z.string().min(1),
        course_name: z.string().min(1),
        deadline: z.string().min(1),
      }),
      kind: 'write',
      requiresConfirmation: true,
      requiredSlots: ['title', 'course_name', 'deadline'],
      slotPrompts: {},
      execute: async () => ({}),
      openAiParameters: {},
      mcpSchema: {},
    };

    const corrupt = slotManager.evaluate(
      createTaskTool,
      {
        toolName: 'create_task',
        intent: 'create_task',
        slots: {
          title: 'es',
          course_name: 'crea una tarea es para el domingo',
          deadline: '2026-06-21',
        },
        awaitingConfirmation: true,
      },
      {
        title: 'hacer semana 4',
        course_name: 'matematica1',
        deadline: '2026-06-22',
      },
      'la tarea es de hacer semana 4 del curso de matematica1, la fecha es para el domingo',
    );
    expect(corrupt.action).toBe('confirm');
    expect(corrupt.mergedSlots.title).toBe('hacer semana 4');
    expect(corrupt.mergedSlots.course_name).toBe('matematica1');
  });

  it('eval: retención de slots tras corrección parcial de fecha', () => {
    const state = {
      toolName: 'schedule_reminder',
      intent: 'schedule_reminder',
      slots: { title: 'Entregar informe', remind_at: '2026-06-18' },
      awaitingConfirmation: true,
    };
    const corrected = slotManager.evaluate(
      scheduleTool,
      state,
      { remind_at: '2026-06-20' },
      'no, mejor el viernes',
    );
    expect(corrected.action).toBe('confirm');
    expect(corrected.mergedSlots.remind_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(corrected.mergedSlots.remind_at).not.toBe('2026-06-18');
    expect(corrected.mergedSlots.title).toBe('Entregar informe');
  });
});
