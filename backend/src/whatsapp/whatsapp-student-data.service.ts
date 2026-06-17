import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumService } from '../curriculum/curriculum.service';
import { Assignment } from '../study-university/entities/assignment.entity';
import { Course } from '../study-university/entities/course.entity';
import { StudyUniversityService } from '../study-university/study-university.service';
import { UserUiState } from '../workspace-preferences/entities/user-ui-state.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  buildCourseDisplayOverlay,
  displayCourseName,
  type CurriculumCourseLike,
} from './slots/course-display';

export type WhatsAppCourseView = {
  id: string;
  name: string;
  code: string | null;
  source: 'study' | 'curriculum';
  status?: string;
  cycleNumber?: number;
};

export type WhatsAppTaskView = {
  id: string;
  title: string;
  course: string;
  courseCode: string | null;
  deadline: string;
  deadlineIso: string;
  priority: string;
  status: string;
};

export type WhatsAppStudentSnapshot = {
  workspaceId: string | null;
  courses: WhatsAppCourseView[];
  tasks: WhatsAppTaskView[];
  curriculum: Array<{
    name: string;
    code: string | null;
    status: string;
    cycleNumber: number;
    credits: number;
  }>;
};

/**
 * Datos académicos para WhatsApp — siempre acotados por `userId`.
 * El webhook resuelve teléfono → usuario Mitsyy; ningún dato se comparte entre cuentas.
 */
@Injectable()
export class WhatsAppStudentDataService {
  private readonly logger = new Logger(WhatsAppStudentDataService.name);

  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly studyService: StudyUniversityService,
    private readonly curriculumService: CurriculumService,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Assignment)
    private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(UserUiState)
    private readonly uiStateRepo: Repository<UserUiState>,
  ) {}

  /** Workspace de estudio activo del alumno (el mismo que ve en la web si está configurado). */
  async resolveBestStudyWorkspaceId(userId: string): Promise<string | null> {
    const workspaces = await this.workspacesService.findAllByUserId(userId);
    const studyWorkspaces = workspaces.filter(
      (w) => w.workspaceType === 'study' || w.workspaceType === 'university',
    );
    if (studyWorkspaces.length === 0) return null;
    if (studyWorkspaces.length === 1) return studyWorkspaces[0].id;

    const uiState = await this.uiStateRepo.findOne({ where: { userId } });
    if (uiState?.currentWorkspaceId) {
      const preferred = studyWorkspaces.find((w) => w.id === uiState.currentWorkspaceId);
      if (preferred) {
        this.logger.debug(
          `Workspace activo en UI para ${userId}: ${preferred.id}`,
        );
        return preferred.id;
      }
    }

    let bestId = studyWorkspaces[0].id;
    let bestScore = -1;
    for (const ws of studyWorkspaces) {
      const counts = await this.countWorkspaceData(ws.id, userId);
      const score = counts.courses * 10 + counts.assignments;
      if (score > bestScore) {
        bestScore = score;
        bestId = ws.id;
      }
    }

    this.logger.debug(
      `Workspace elegido para ${userId}: ${bestId} (score=${bestScore}, total=${studyWorkspaces.length})`,
    );
    return bestId;
  }

  private async countWorkspaceData(
    workspaceId: string,
    userId: string,
  ): Promise<{ courses: number; assignments: number }> {
    const [courses, assignments] = await Promise.all([
      this.courseRepo.count({ where: { workspaceId, userId, archived: false } }),
      this.assignmentRepo.count({ where: { workspaceId } }),
    ]);
    return { courses, assignments };
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-PE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Lima',
    });
  }

  async getSnapshot(userId: string): Promise<WhatsAppStudentSnapshot> {
    const workspaceId = await this.resolveBestStudyWorkspaceId(userId);
    const curriculumData = await this.curriculumService.getCurriculum(userId).catch(() => null);

    let studyCourses: Course[] = [];
    let assignments: Assignment[] = [];

    if (workspaceId) {
      try {
        const state = await this.studyService.getWorkspaceState(workspaceId, userId);
        studyCourses = state.courses.filter((c) => !c.archived);
        assignments = state.assignments;
      } catch (err) {
        this.logger.warn(
          `No se pudo cargar workspace ${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const courseMap = new Map(studyCourses.map((c) => [c.id, c]));
    const curriculumCourses: CurriculumCourseLike[] = (curriculumData?.courses ?? []).map(
      (c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        linkedCourseId: c.linkedCourseId ?? null,
        status: c.status,
      }),
    );
    const displayOverlay = buildCourseDisplayOverlay(studyCourses, curriculumCourses);

    const mergedCourses: WhatsAppCourseView[] = studyCourses.map((c) => {
      const display = displayOverlay.get(c.id);
      return {
        id: c.id,
        name: display?.name ?? c.name,
        code: display?.code ?? c.code,
        source: 'study' as const,
      };
    });

    for (const cc of curriculumData?.courses ?? []) {
      if (cc.status !== 'in_progress' && cc.status !== 'pending') continue;
      const already = mergedCourses.some(
        (c) =>
          c.id === cc.linkedCourseId ||
          c.name.toLowerCase() === cc.name.toLowerCase() ||
          (c.code && cc.code && c.code.toLowerCase() === cc.code.toLowerCase()),
      );
      if (!already) {
        mergedCourses.push({
          id: cc.linkedCourseId ?? cc.id,
          name: cc.name,
          code: cc.code,
          source: 'curriculum',
          status: cc.status,
          cycleNumber: cc.cycleNumber,
        });
      }
    }

    const pendingTasks = assignments
      .filter((a) => a.status !== 'done' && a.status !== 'submitted')
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .map((a) => {
        const course = courseMap.get(a.courseId);
        const deadline = new Date(a.deadline);
        return {
          id: a.id,
          title: a.title,
          course: displayCourseName(a.courseId, course?.name ?? 'Sin curso', displayOverlay),
          courseCode: displayOverlay.get(a.courseId)?.code ?? course?.code ?? null,
          deadline: this.formatDate(deadline),
          deadlineIso: deadline.toISOString(),
          priority: a.priority,
          status: a.status,
        };
      });

    return {
      workspaceId,
      courses: mergedCourses,
      tasks: pendingTasks,
      curriculum: (curriculumData?.courses ?? []).map((c) => ({
        name: c.name,
        code: c.code,
        status: c.status,
        cycleNumber: c.cycleNumber,
        credits: c.credits,
      })),
    };
  }

  findCourseByName(courses: Course[], name: string): Course | undefined {
    const normalized = name.toLowerCase().trim();
    return (
      courses.find((c) => c.name.toLowerCase() === normalized) ??
      courses.find((c) => c.code?.toLowerCase() === normalized) ??
      courses.find((c) => c.name.toLowerCase().includes(normalized)) ??
      courses.find((c) => c.code?.toLowerCase().includes(normalized))
    );
  }
}
