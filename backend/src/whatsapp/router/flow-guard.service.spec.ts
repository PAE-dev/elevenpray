import { WhatsAppFlowGuardService } from './flow-guard.service';
import type { IntentClassification } from './routing.types';

describe('WhatsAppFlowGuardService', () => {
  const guard = new WhatsAppFlowGuardService({
    get: () => ({
      confidenceThreshold: 0.55,
      cancellationConfidenceThreshold: 0.7,
      topicChangeConfidenceThreshold: 0.8,
    }),
  } as never);

  it('mantiene flujo activo cuando el mensaje continúa creando tarea', () => {
    const classification: IntentClassification = {
      intent: 'get_courses',
      confidence: 0.6,
      reasoning: 'menciona curso',
    };
    const decision = guard.evaluate(classification, 'creando_tarea');
    expect(decision.action).toBe('continue_flow');
    expect(decision.intent).toBe('create_task');
  });

  it('reinicia sesión con cancelación de alta confianza', () => {
    const classification: IntentClassification = {
      intent: 'cancelar_reiniciar',
      confidence: 0.9,
      reasoning: 'usuario quiere cancelar',
    };
    const decision = guard.evaluate(classification, 'creando_tarea');
    expect(decision.action).toBe('reset_session');
  });

  it('permite cambio de tema con alta confianza', () => {
    const classification: IntentClassification = {
      intent: 'get_tasks',
      confidence: 0.92,
      reasoning: 'pide ver tareas explícitamente',
    };
    const decision = guard.evaluate(classification, 'creando_tarea');
    expect(decision.action).toBe('route_new_intent');
    expect(decision.intent).toBe('get_tasks');
  });

  it('pide aclaración con baja confianza sin flujo activo', () => {
    const classification: IntentClassification = {
      intent: 'create_task',
      confidence: 0.4,
      reasoning: 'ambiguo',
    };
    const decision = guard.evaluate(classification, 'none');
    expect(decision.action).toBe('needs_clarification');
  });
});
