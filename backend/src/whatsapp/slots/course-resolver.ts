export interface CourseLike {
  id: string;
  name: string;
  code?: string | null;
}

/** Resuelve un nombre/código mencionado por el alumno contra sus cursos en Mitsyy. */
export function resolveCourseInSnapshot(
  input: string,
  courses: CourseLike[],
): CourseLike | null {
  const q = input.trim().toLowerCase();
  if (!q || courses.length === 0) return null;

  const exact = courses.find(
    (c) =>
      c.name.toLowerCase() === q || c.code?.toLowerCase() === q,
  );
  if (exact) return exact;

  const partial = courses.find(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      q.includes(c.name.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(q)),
  );
  if (partial) return partial;

  return null;
}
