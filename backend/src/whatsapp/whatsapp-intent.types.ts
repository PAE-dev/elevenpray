import { z } from 'zod';

/** @deprecated Importar desde router/routing.types */
export {
  WhatsAppIntentEnum,
  IntentClassificationSchema,
  intentToToolName,
  intentToDomain,
  type WhatsAppIntent,
  type IntentClassification,
  type WhatsAppDomain,
  type RouteDecision,
} from './router/routing.types';

/** Re-export para compatibilidad con imports legacy. */
export type { WhatsAppIntent as LegacyWhatsAppIntent } from './router/routing.types';

/** Schema vacío legacy — no usar en código nuevo. */
export const LegacyToolArgsSchema = z.object({});
