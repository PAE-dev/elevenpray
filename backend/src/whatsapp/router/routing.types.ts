import { z } from 'zod';

export const WhatsAppIntentEnum = z.enum([
  'saludo_inicio',
  'cancelar_reiniciar',
  'get_courses',
  'get_tasks',
  'create_task',
  'edit_task',
  'get_curriculum',
  'schedule_reminder',
  'general_chat',
  'unknown',
]);

export type WhatsAppIntent = z.infer<typeof WhatsAppIntentEnum>;

export const ActiveFlowEnum = z.enum([
  'none',
  'creando_tarea',
  'editando_tarea',
  'agendando_recordatorio',
]);

export type ActiveFlow = z.infer<typeof ActiveFlowEnum>;

export const IntentClassificationSchema = z.object({
  intent: WhatsAppIntentEnum,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type IntentClassification = z.infer<typeof IntentClassificationSchema>;

export type WhatsAppDomain =
  | 'tasks'
  | 'courses'
  | 'reminders'
  | 'curriculum'
  | 'chat';

export interface RouteDecision {
  domain: WhatsAppDomain;
  intent: WhatsAppIntent;
  confidence: number;
  reasoning: string;
  needsClarification: boolean;
}

export interface ClassifierContext {
  userMessage: string;
  recentTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
  activeFlow: ActiveFlow;
  activeIntent: WhatsAppIntent | null;
  slots: Record<string, unknown>;
  awaitingSlot: string | null;
  awaitingConfirmation: boolean;
  lastToolResult: unknown;
  conversationSummary: string | null;
}

export type FlowGuardAction =
  | 'continue_flow'
  | 'reset_session'
  | 'route_new_intent'
  | 'needs_clarification';

export interface FlowGuardDecision {
  action: FlowGuardAction;
  intent: WhatsAppIntent;
  confidence: number;
  reasoning: string;
}

const TOOL_TO_FLOW: Record<string, ActiveFlow> = {
  create_task: 'creando_tarea',
  edit_task: 'editando_tarea',
  schedule_reminder: 'agendando_recordatorio',
};

const FLOW_TO_INTENT: Record<Exclude<ActiveFlow, 'none'>, WhatsAppIntent> = {
  creando_tarea: 'create_task',
  editando_tarea: 'edit_task',
  agendando_recordatorio: 'schedule_reminder',
};

export function toolNameToActiveFlow(toolName: string | null): ActiveFlow {
  if (!toolName) return 'none';
  return TOOL_TO_FLOW[toolName] ?? 'none';
}

export function activeFlowToIntent(flow: ActiveFlow): WhatsAppIntent | null {
  if (flow === 'none') return null;
  return FLOW_TO_INTENT[flow];
}

export function intentToDomain(intent: WhatsAppIntent): WhatsAppDomain {
  switch (intent) {
    case 'get_tasks':
    case 'create_task':
    case 'edit_task':
      return 'tasks';
    case 'get_courses':
      return 'courses';
    case 'schedule_reminder':
      return 'reminders';
    case 'get_curriculum':
      return 'curriculum';
    case 'saludo_inicio':
    case 'cancelar_reiniciar':
    case 'general_chat':
    case 'unknown':
    default:
      return 'chat';
  }
}

export function intentToToolName(intent: WhatsAppIntent): string | null {
  switch (intent) {
    case 'get_courses':
      return 'get_courses';
    case 'get_tasks':
      return 'list_tasks';
    case 'create_task':
      return 'create_task';
    case 'edit_task':
      return 'edit_task';
    case 'get_curriculum':
      return 'get_curriculum';
    case 'schedule_reminder':
      return 'schedule_reminder';
    default:
      return null;
  }
}

export function isReadIntent(intent: WhatsAppIntent): boolean {
  return ['get_courses', 'get_tasks', 'get_curriculum'].includes(intent);
}

export function isWriteIntent(intent: WhatsAppIntent): boolean {
  return ['create_task', 'edit_task', 'schedule_reminder'].includes(intent);
}
