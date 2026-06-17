import { Annotation } from '@langchain/langgraph';
import type { User } from '../../users/entities/user.entity';
import type { WhatsAppDomain, WhatsAppIntent } from '../router/routing.types';

export const WhatsAppGraphState = Annotation.Root({
  user: Annotation<User>,
  threadId: Annotation<string>,
  userMessage: Annotation<string>,
  intent: Annotation<WhatsAppIntent>({
    reducer: (_, next) => next,
    default: () => 'general_chat' as WhatsAppIntent,
  }),
  domain: Annotation<WhatsAppDomain>({
    reducer: (_, next) => next,
    default: () => 'chat' as WhatsAppDomain,
  }),
  confidence: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  toolName: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  toolArgs: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  toolResult: Annotation<unknown>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  reply: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  llmCalls: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
  /** Snapshot académico cacheado por turno (evita cargas duplicadas). */
  snapshotLoaded: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  phase: Annotation<'route' | 'slots' | 'confirm' | 'execute' | 'present' | 'done'>({
    reducer: (_, next) => next,
    default: () => 'route' as const,
  }),
});

export type WhatsAppGraphStateType = typeof WhatsAppGraphState.State;
