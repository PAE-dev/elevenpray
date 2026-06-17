import type { z } from 'zod';
import type { User } from '../../users/entities/user.entity';
import type { WhatsAppIntent } from '../router/routing.types';

export type ToolDomain =
  | 'tasks'
  | 'courses'
  | 'reminders'
  | 'curriculum'
  | 'chat';

export type ToolKind = 'read' | 'write';

export interface ToolExecutionContext {
  user: User;
  args: Record<string, unknown>;
}

export interface WhatsAppToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  domain: ToolDomain;
  intent: WhatsAppIntent | null;
  description: string;
  argsSchema: TSchema;
  kind: ToolKind;
  requiresConfirmation: boolean;
  /** Slots obligatorios para tools de escritura. */
  requiredSlots: string[];
  /** Pregunta breve en español por slot faltante. */
  slotPrompts: Record<string, string>;
  /** Handler de dominio puro — devuelve datos estructurados, sin formato WhatsApp. */
  execute: (ctx: ToolExecutionContext) => Promise<unknown>;
}
