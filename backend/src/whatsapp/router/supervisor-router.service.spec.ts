import { intentToDomain, intentToToolName } from './routing.types';
import { WhatsAppSupervisorRouterService } from './supervisor-router.service';

describe('WhatsAppSupervisorRouterService routing', () => {
  const router = new WhatsAppSupervisorRouterService(
    {
      get: () => ({ confidenceThreshold: 0.55 }),
    } as never,
    {} as never,
  );

  it('enruta intents de lectura al dominio correcto', () => {
    expect(intentToDomain('get_tasks')).toBe('tasks');
    expect(intentToDomain('get_courses')).toBe('courses');
    expect(intentToDomain('get_curriculum')).toBe('curriculum');
    expect(intentToToolName('get_tasks')).toBe('list_tasks');
    expect(intentToDomain('saludo_inicio')).toBe('chat');
    expect(intentToDomain('cancelar_reiniciar')).toBe('chat');
  });

  it('pide aclaración si confianza está por debajo del umbral', () => {
    const decision = router.route({
      intent: 'create_task',
      confidence: 0.3,
      reasoning: 'mensaje ambiguo',
    });
    expect(decision.needsClarification).toBe(true);
    expect(decision.domain).toBe('tasks');
  });

  it('no pide aclaración para chat general ni saludo', () => {
    const chat = router.route({
      intent: 'general_chat',
      confidence: 0.2,
      reasoning: 'charla',
    });
    expect(chat.needsClarification).toBe(false);

    const greeting = router.route({
      intent: 'saludo_inicio',
      confidence: 0.9,
      reasoning: 'saludo',
    });
    expect(greeting.needsClarification).toBe(false);
  });
});
