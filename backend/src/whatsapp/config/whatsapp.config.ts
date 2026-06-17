import { registerAs } from '@nestjs/config';

export interface WhatsAppConfig {
  /** Umbral mínimo de confianza para ejecutar una intención (0-1). */
  confidenceThreshold: number;
  /** Porcentaje de tráfico al nuevo supervisor (0-100). */
  supervisorRolloutPercent: number;
  /** Modelo rápido: clasificación, routing, extracción de slots. */
  fastModel: string;
  /** Modelo capaz: chat general y razonamiento complejo. */
  capableModel: string;
  /** Zona horaria por defecto para parsing de fechas. */
  defaultTimezone: string;
  /** Máximo de turnos antes de resumir historial. */
  historyTurnThreshold: number;
  /** Turnos recientes para desambiguación contextual. */
  contextWindowTurns: number;
  /** Proveedor de trazas: langsmith | langfuse | none */
  traceProvider: 'langsmith' | 'langfuse' | 'none';
  /** Redis URL para BullMQ (opcional). */
  redisUrl: string | null;
  /** Habilitar worker de recordatorios en este proceso. */
  enableReminderWorker: boolean;
  /** Minutos sin actividad antes de descartar un flujo de slots pendiente. */
  pendingFlowTtlMinutes: number;
  /** Horas sin mensajes antes de iniciar sesión nueva automáticamente. */
  sessionTimeoutHours: number;
  /** Confianza mínima para interpretar cancelación/reinicio semántico. */
  cancellationConfidenceThreshold: number;
  /** Confianza mínima para abandonar un flujo activo por cambio de tema. */
  topicChangeConfidenceThreshold: number;
}

export default registerAs(
  'whatsapp',
  (): WhatsAppConfig => ({
    confidenceThreshold: parseFloat(
      process.env.WHATSAPP_CONFIDENCE_THRESHOLD ?? '0.55',
    ),
    supervisorRolloutPercent: parseInt(
      process.env.WHATSAPP_SUPERVISOR_ROLLOUT_PERCENT ?? '100',
      10,
    ),
    fastModel:
      process.env.WHATSAPP_FAST_MODEL ??
      process.env.OPENAI_MODEL ??
      'gpt-4o-mini',
    capableModel:
      process.env.WHATSAPP_CAPABLE_MODEL ??
      process.env.OPENAI_MODEL ??
      'gpt-4o-mini',
    defaultTimezone: process.env.WHATSAPP_DEFAULT_TIMEZONE ?? 'America/Lima',
    historyTurnThreshold: parseInt(
      process.env.WHATSAPP_HISTORY_TURN_THRESHOLD ?? '20',
      10,
    ),
    contextWindowTurns: parseInt(
      process.env.WHATSAPP_CONTEXT_WINDOW_TURNS ?? '6',
      10,
    ),
    traceProvider:
      (process.env.WHATSAPP_TRACE_PROVIDER as WhatsAppConfig['traceProvider']) ??
      'none',
    redisUrl: process.env.REDIS_URL ?? null,
    enableReminderWorker: process.env.WHATSAPP_ENABLE_REMINDER_WORKER === 'true',
    pendingFlowTtlMinutes: parseInt(
      process.env.WHATSAPP_PENDING_FLOW_TTL_MINUTES ?? '30',
      10,
    ),
    sessionTimeoutHours: parseInt(
      process.env.WHATSAPP_SESSION_TIMEOUT_HOURS ?? '6',
      10,
    ),
    cancellationConfidenceThreshold: parseFloat(
      process.env.WHATSAPP_CANCELLATION_CONFIDENCE_THRESHOLD ?? '0.7',
    ),
    topicChangeConfidenceThreshold: parseFloat(
      process.env.WHATSAPP_TOPIC_CHANGE_CONFIDENCE_THRESHOLD ?? '0.8',
    ),
  }),
);

export function shouldUseSupervisor(userId: string, rolloutPercent: number): boolean {
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 100 < rolloutPercent;
}
