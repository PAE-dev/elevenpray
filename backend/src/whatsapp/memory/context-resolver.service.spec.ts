import { WhatsAppContextResolverService } from './context-resolver.service';

describe('WhatsAppContextResolverService', () => {
  const resolver = new WhatsAppContextResolverService();

  const snapshot = {
    workspaceId: 'ws-1',
    courses: [
      { id: 'c1', name: 'Cálculo I', code: 'MAT101', source: 'study' as const },
      { id: 'c2', name: 'Física', code: 'FIS101', source: 'study' as const },
    ],
    tasks: [{ id: 't1', title: 'Parcial Cálculo', course: 'Cálculo I', courseCode: 'MAT101', deadline: '20 jun', deadlineIso: '2026-06-20', priority: 'high', status: 'pending' }],
    curriculum: [],
  };

  it('resuelve referencia a tarea única del último resultado', () => {
    const ref = resolver.resolve(
      'cancela esa tarea',
      snapshot,
      { tasks: [{ title: 'Parcial Cálculo' }] },
      [],
    );
    expect(ref.type).toBe('task');
    expect(ref.ambiguous).toBe(false);
    expect(ref.value).toBe('Parcial Cálculo');
  });

  it('marca ambigüedad cuando hay varios cursos', () => {
    const ref = resolver.resolve('el curso de ayer', snapshot, null, []);
    expect(ref.type).toBe('course');
    expect(ref.ambiguous).toBe(true);
    expect(ref.candidates?.length).toBeGreaterThan(1);
  });

  it('genera pregunta de desambiguación', () => {
    const ref = resolver.resolve('ese curso', snapshot, null, []);
    const question = resolver.buildDisambiguationQuestion(ref);
    expect(question).toContain('¿A cuál curso');
    expect(question).toContain('Cálculo I');
  });
});
