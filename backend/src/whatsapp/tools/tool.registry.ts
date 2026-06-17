import { z } from 'zod';
import type { WhatsAppToolDefinition } from './tool.types';
import { zodToMcpJsonSchema, zodToOpenAiParameters } from './tool.schema';

const ListTasksArgsSchema = z.object({
  status: z.enum(['pending', 'all']).optional(),
  limit: z.number().int().min(1).max(30).optional(),
});

const CreateTaskArgsSchema = z.object({
  title: z.string().min(1),
  course_name: z.string().min(1),
  deadline: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

const EditTaskArgsSchema = z.object({
  task_title: z.string().min(1),
  field: z.enum(['title', 'deadline', 'course_name']),
  new_value: z.string().min(1),
});

const GetCoursesArgsSchema = z.object({});

const ListCoursesArgsSchema = z.object({
  cycle_number: z.number().int().optional(),
});

const GetCurriculumArgsSchema = z.object({});

const ScheduleReminderArgsSchema = z.object({
  title: z.string().min(1),
  remind_at: z.string().min(1),
  note: z.string().optional(),
});

export type ToolRegistryEntry = WhatsAppToolDefinition & {
  openAiParameters: Record<string, unknown>;
  mcpSchema: Record<string, unknown>;
};

function defineTool<T extends z.ZodType>(
  def: WhatsAppToolDefinition<T>,
): ToolRegistryEntry {
  return {
    ...def,
    openAiParameters: zodToOpenAiParameters(def.argsSchema),
    mcpSchema: zodToMcpJsonSchema(def.argsSchema, def.name),
  };
}

/** Registry declarativo — SSOT para tools del asistente WhatsApp. */
export function createToolRegistry(deps: {
  listTasks: WhatsAppToolDefinition['execute'];
  createTask: WhatsAppToolDefinition['execute'];
  editTask: WhatsAppToolDefinition['execute'];
  getCourses: WhatsAppToolDefinition['execute'];
  listCourses: WhatsAppToolDefinition['execute'];
  getCurriculum: WhatsAppToolDefinition['execute'];
  scheduleReminder: WhatsAppToolDefinition['execute'];
}): Map<string, ToolRegistryEntry> {
  const tools: ToolRegistryEntry[] = [
    defineTool({
      name: 'list_tasks',
      domain: 'tasks',
      intent: 'get_tasks',
      description: 'Lista tareas pendientes del estudiante',
      argsSchema: ListTasksArgsSchema,
      kind: 'read',
      requiresConfirmation: false,
      requiredSlots: [],
      slotPrompts: {},
      execute: deps.listTasks,
    }),
    defineTool({
      name: 'create_task',
      domain: 'tasks',
      intent: 'create_task',
      description: 'Crea una tarea nueva en Mitsyy',
      argsSchema: CreateTaskArgsSchema,
      kind: 'write',
      requiresConfirmation: true,
      requiredSlots: ['title', 'course_name', 'deadline'],
      slotPrompts: {
        title: '¿Cuál es el título de la tarea?',
        course_name: '¿Para qué curso es? (nombre o código)',
        deadline: '¿Para qué fecha? (ej. 20 jun 2026 o 2026-06-20)',
      },
      execute: deps.createTask,
    }),
    defineTool({
      name: 'edit_task',
      domain: 'tasks',
      intent: 'edit_task',
      description: 'Edita una tarea existente en Mitsyy',
      argsSchema: EditTaskArgsSchema,
      kind: 'write',
      requiresConfirmation: true,
      requiredSlots: ['task_title', 'field', 'new_value'],
      slotPrompts: {},
      execute: deps.editTask,
    }),
    defineTool({
      name: 'get_courses',
      domain: 'courses',
      intent: 'get_courses',
      description: 'Lista materias del ciclo actual',
      argsSchema: GetCoursesArgsSchema,
      kind: 'read',
      requiresConfirmation: false,
      requiredSlots: [],
      slotPrompts: {},
      execute: deps.getCourses,
    }),
    defineTool({
      name: 'list_courses',
      domain: 'courses',
      intent: null,
      description: 'Lista cursos con filtros opcionales',
      argsSchema: ListCoursesArgsSchema,
      kind: 'read',
      requiresConfirmation: false,
      requiredSlots: [],
      slotPrompts: {},
      execute: deps.listCourses,
    }),
    defineTool({
      name: 'get_curriculum',
      domain: 'curriculum',
      intent: 'get_curriculum',
      description: 'Muestra malla curricular y avance',
      argsSchema: GetCurriculumArgsSchema,
      kind: 'read',
      requiresConfirmation: false,
      requiredSlots: [],
      slotPrompts: {},
      execute: deps.getCurriculum,
    }),
    defineTool({
      name: 'schedule_reminder',
      domain: 'reminders',
      intent: 'schedule_reminder',
      description: 'Agenda un recordatorio por WhatsApp',
      argsSchema: ScheduleReminderArgsSchema,
      kind: 'write',
      requiresConfirmation: true,
      requiredSlots: ['title', 'remind_at'],
      slotPrompts: {
        title: '¿De qué quieres que te recuerde?',
        remind_at: '¿Cuándo? (fecha y hora, ej. mañana 9am o 2026-06-17T09:00)',
      },
      execute: deps.scheduleReminder,
    }),
  ];

  const byName = new Map<string, ToolRegistryEntry>();
  for (const tool of tools) {
    byName.set(tool.name, tool);
  }
  return byName;
}

export function getToolByIntent(
  registry: Map<string, ToolRegistryEntry>,
  intent: string,
): ToolRegistryEntry | undefined {
  for (const tool of registry.values()) {
    if (tool.intent === intent) return tool;
  }
  return undefined;
}

export {
  ListTasksArgsSchema,
  CreateTaskArgsSchema,
  GetCoursesArgsSchema,
  ScheduleReminderArgsSchema,
};
