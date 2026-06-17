import { WhatsAppFlowGuardService } from '../router/flow-guard.service';
import type { IntentClassification } from '../router/routing.types';
import { toolNameToActiveFlow } from '../router/routing.types';

/**
 * Tests de comportamiento del grafo (routing + precedencia de flujo)
 * sin depender del LLM real — simulan la salida del clasificador.
 */
describe('WhatsApp graph routing behavior', () => {
  const guard = new WhatsAppFlowGuardService({
    get: () => ({
      confidenceThreshold: 0.55,
      cancellationConfidenceThreshold: 0.7,
      topicChangeConfidenceThreshold: 0.8,
    }),
  } as never);

  function simulateTurn(params: {
    classification: IntentClassification;
    activeFlow: ReturnType<typeof toolNameToActiveFlow>;
    pendingTool?: string | null;
  }): {
    guardAction: string;
    routedIntent: string;
    continuesFlow: boolean;
  } {
    const activeFlow = params.pendingTool
      ? toolNameToActiveFlow(params.pendingTool)
      : params.activeFlow;

    const decision = guard.evaluate(params.classification, activeFlow);

    return {
      guardAction: decision.action,
      routedIntent: decision.intent,
      continuesFlow: decision.action === 'continue_flow',
    };
  }

  it('crear tarea en 3 mensajes: turno 2 continúa flujo al mencionar curso', () => {
  const turn2 = simulateTurn({
      classification: {
        intent: 'get_courses',
        confidence: 0.55,
        reasoning: 'menciona curso en contexto de creación',
      },
      activeFlow: 'creando_tarea',
      pendingTool: 'create_task',
    });
    expect(turn2.continuesFlow).toBe(true);
    expect(turn2.routedIntent).toBe('create_task');
  });

  it('crear tarea: turno 3 con fecha continúa flujo', () => {
    const turn3 = simulateTurn({
      classification: {
        intent: 'unknown',
        confidence: 0.4,
        reasoning: 'solo fecha en contexto de flujo',
      },
      activeFlow: 'creando_tarea',
      pendingTool: 'create_task',
    });
    expect(turn3.continuesFlow).toBe(true);
  });

  it('cambio de tema a mitad de flujo con alta confianza', () => {
    const result = simulateTurn({
      classification: {
        intent: 'get_tasks',
        confidence: 0.95,
        reasoning: 'usuario pide ver tareas explícitamente',
      },
      activeFlow: 'creando_tarea',
      pendingTool: 'create_task',
    });
    expect(result.guardAction).toBe('route_new_intent');
    expect(result.routedIntent).toBe('get_tasks');
  });

  it('cancelación semántica reinicia', () => {
    const result = simulateTurn({
      classification: {
        intent: 'cancelar_reiniciar',
        confidence: 0.92,
        reasoning: 'mejor no, olvídalo',
      },
      activeFlow: 'creando_tarea',
      pendingTool: 'create_task',
    });
    expect(result.guardAction).toBe('reset_session');
  });

  it('saludo con typo sin flujo activo reinicia sesión', () => {
    const result = simulateTurn({
      classification: {
        intent: 'saludo_inicio',
        confidence: 0.9,
        reasoning: 'holpa interpretado como saludo',
      },
      activeFlow: 'none',
    });
    expect(result.guardAction).toBe('reset_session');
  });

  it('baja confianza sin flujo activo pide aclaración', () => {
    const result = simulateTurn({
      classification: {
        intent: 'create_task',
        confidence: 0.35,
        reasoning: 'mensaje ambiguo',
      },
      activeFlow: 'none',
    });
    expect(result.guardAction).toBe('needs_clarification');
  });
});
