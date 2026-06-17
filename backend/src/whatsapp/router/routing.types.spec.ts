import { IntentClassificationSchema } from './routing.types';

describe('IntentClassificationSchema', () => {
  it('acepta intents del enum con reasoning', () => {
    const result = IntentClassificationSchema.parse({
      intent: 'saludo_inicio',
      confidence: 0.95,
      reasoning: 'saludo coloquial',
    });
    expect(result.intent).toBe('saludo_inicio');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('rechaza confidence fuera de rango', () => {
    expect(() =>
      IntentClassificationSchema.parse({
        intent: 'get_tasks',
        confidence: 1.5,
        reasoning: 'test',
      }),
    ).toThrow();
  });

  it('incluye cancelar_reiniciar en el enum', () => {
    const result = IntentClassificationSchema.parse({
      intent: 'cancelar_reiniciar',
      confidence: 0.88,
      reasoning: 'usuario abandona flujo',
    });
    expect(result.intent).toBe('cancelar_reiniciar');
  });
});
