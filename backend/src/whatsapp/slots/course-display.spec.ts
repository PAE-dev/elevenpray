import {
  buildCourseDisplayOverlay,
  displayCourseName,
  type CurriculumCourseLike,
} from './course-display';

describe('buildCourseDisplayOverlay', () => {
  const studyCourses = [
    { id: 'study-1', name: 'sss', code: 'asd', archived: false },
  ];

  it('usa nombre de malla cuando el curso está enlazado', () => {
    const overlay = buildCourseDisplayOverlay(studyCourses, [
      {
        id: 'curr-1',
        name: 'matematicas',
        code: 'asd',
        linkedCourseId: 'study-1',
        status: 'in_progress',
      },
    ]);
    expect(displayCourseName('study-1', 'sss', overlay)).toBe('matematicas');
  });

  it('empareja por código si aún no hay enlace formal', () => {
    const overlay = buildCourseDisplayOverlay(studyCourses, [
      {
        id: 'curr-1',
        name: 'matematicas',
        code: 'asd',
        linkedCourseId: null,
        status: 'in_progress',
      },
    ]);
    expect(displayCourseName('study-1', 'sss', overlay)).toBe('matematicas');
  });
});
