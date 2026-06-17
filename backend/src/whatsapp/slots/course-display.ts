export type CurriculumCourseLike = {
  id: string;
  name: string;
  code: string | null;
  linkedCourseId: string | null;
  status: string;
};

export type StudyCourseLike = {
  id: string;
  name: string;
  code: string | null;
  archived?: boolean;
};

/**
 * La web puede renombrar cursos en la malla curricular antes de que el workspace
 * de estudio quede enlazado. Este overlay usa el nombre de la malla como fuente
 * de verdad para mostrar al alumno.
 */
export function buildCourseDisplayOverlay(
  studyCourses: StudyCourseLike[],
  curriculumCourses: CurriculumCourseLike[],
): Map<string, { name: string; code: string | null }> {
  const overlay = new Map<string, { name: string; code: string | null }>();
  const activeStudy = studyCourses.filter((c) => !c.archived);

  for (const cc of curriculumCourses) {
    if (cc.status !== 'in_progress' && cc.status !== 'pending') continue;

    if (cc.linkedCourseId) {
      overlay.set(cc.linkedCourseId, { name: cc.name, code: cc.code });
      continue;
    }

    if (cc.code) {
      const curriculumCode = cc.code.toLowerCase();
      const byCode = activeStudy.find(
        (sc) =>
          sc.code &&
          sc.code.toLowerCase() === curriculumCode &&
          !overlay.has(sc.id),
      );
      if (byCode) {
        overlay.set(byCode.id, { name: cc.name, code: cc.code });
        continue;
      }
    }

    const byName = activeStudy.find(
      (sc) =>
        sc.name.toLowerCase() === cc.name.toLowerCase() && !overlay.has(sc.id),
    );
    if (byName) {
      overlay.set(byName.id, { name: cc.name, code: cc.code });
    }
  }

  return overlay;
}

export function displayCourseName(
  courseId: string,
  studyName: string,
  overlay: Map<string, { name: string; code: string | null }>,
): string {
  return overlay.get(courseId)?.name ?? studyName;
}
