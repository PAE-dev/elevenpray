import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { User } from '../users/entities/user.entity';
import { CurriculumService } from '../curriculum/curriculum.service';
import { StudyUniversityService } from '../study-university/study-university.service';
import { Reminder } from '../study-university/entities/reminder.entity';
import {
  WhatsAppStudentDataService,
  type WhatsAppStudentSnapshot,
} from './whatsapp-student-data.service';
import { resolveCourseInSnapshot } from './slots/course-resolver';

export interface CourseToolItem {
  id: string;
  name: string;
}

export interface CoursesToolPayload {
  courses: CourseToolItem[];
  total: number;
  sourceWorkspaceId: string | null;
}

@Injectable()
export class WhatsAppToolsService {
  private readonly logger = new Logger(WhatsAppToolsService.name);

  constructor(
    private readonly dataService: WhatsAppStudentDataService,
    private readonly studyService: StudyUniversityService,
    private readonly curriculumService: CurriculumService,
    @InjectRepository(Reminder)
    private readonly reminderRepo: Repository<Reminder>,
  ) {}

  async getSnapshot(userId: string): Promise<WhatsAppStudentSnapshot> {
    return this.dataService.getSnapshot(userId);
  }

  async execute(user: User, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    this.logger.log(`Tool ${toolName} para user ${user.id}: ${JSON.stringify(args)}`);
    switch (toolName) {
      case 'list_tasks':
        return this.listTasks(user.id, args);
      case 'create_task':
        return this.createTask(user.id, args);
      case 'get_courses':
        return this.getCoursesToolPayload(user.id);
      case 'list_courses':
        return this.listCourses(user.id, args);
      case 'get_curriculum':
        return this.getCurriculum(user.id);
      case 'schedule_reminder':
        return this.scheduleReminder(user.id, args);
      default:
        throw new BadRequestException(`Tool desconocida: ${toolName}`);
    }
  }

  async listTasks(userId: string, args: Record<string, unknown>) {
    const snapshot = await this.dataService.getSnapshot(userId);
    const includeDone = args.status === 'all';
    const limit = Math.min(Number(args.limit) || 20, 30);

    let tasks = snapshot.tasks;
    if (includeDone && snapshot.workspaceId) {
      const state = await this.studyService.getWorkspaceState(snapshot.workspaceId, userId);
      const courseMap = new Map(state.courses.map((c) => [c.id, c]));
      tasks = state.assignments
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        .map((a) => {
          const course = courseMap.get(a.courseId);
          const deadline = new Date(a.deadline);
          return {
            id: a.id,
            title: a.title,
            course: course?.name ?? 'Sin curso',
            courseCode: course?.code ?? null,
            deadline: deadline.toLocaleDateString('es-PE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              timeZone: 'America/Lima',
            }),
            deadlineIso: deadline.toISOString(),
            priority: a.priority,
            status: a.status,
          };
        });
    }

    tasks = tasks.slice(0, limit);

    if (tasks.length === 0) {
      return {
        tasks: [],
        total: 0,
        message: 'No tienes tareas pendientes registradas en Mitsyy.',
      };
    }

    return { tasks, total: tasks.length };
  }

  async createTask(userId: string, args: Record<string, unknown>) {
    const title = String(args.title ?? '').trim();
    const courseName = String(args.course_name ?? '').trim();
    const deadline = String(args.deadline ?? '').trim();

    if (!title || !courseName || !deadline) {
      throw new BadRequestException('title, course_name y deadline son obligatorios');
    }

    const snapshot = await this.dataService.getSnapshot(userId);
    const resolved = resolveCourseInSnapshot(courseName, snapshot.courses);
    if (!resolved) {
      const available = snapshot.courses.map((c) => c.name).join(', ');
      throw new NotFoundException(
        `No encontré el curso "${courseName}". Cursos en Mitsyy: ${available || 'ninguno'}`,
      );
    }

    const workspaceId = snapshot.workspaceId ?? await this.dataService.resolveBestStudyWorkspaceId(userId);
    if (!workspaceId) {
      throw new NotFoundException('No tienes un espacio de estudio en Mitsyy.');
    }

    const state = await this.studyService.getWorkspaceState(workspaceId, userId);
    let course = state.courses.find((c) => c.id === resolved.id);

    if (!course) {
      course = this.dataService.findCourseByName(state.courses, resolved.name);
    }

    if (!course) {
      const available = snapshot.courses.map((c) => c.name).join(', ');
      throw new NotFoundException(
        `No encontré el curso "${courseName}". Cursos en Mitsyy: ${available || 'ninguno'}`,
      );
    }

    const deadlineDate = new Date(
      deadline.includes('T') ? deadline : `${deadline}T23:59:59`,
    );
    if (Number.isNaN(deadlineDate.getTime())) {
      throw new BadRequestException('deadline inválida. Usa formato ISO, ej. 2026-06-20');
    }

    const priority = ['low', 'medium', 'high', 'urgent'].includes(String(args.priority))
      ? (String(args.priority) as 'low' | 'medium' | 'high' | 'urgent')
      : 'medium';

    const assignment = await this.studyService.createAssignment(workspaceId, userId, {
      courseId: course.id,
      title,
      description: args.description ? String(args.description) : undefined,
      deadline: deadlineDate.toISOString(),
      priority,
      status: 'pending',
    });

    return {
      success: true,
      task: {
        id: assignment.id,
        title: assignment.title,
        course: course.name,
        deadline: deadlineDate.toLocaleDateString('es-PE', { timeZone: 'America/Lima' }),
        priority: assignment.priority,
      },
    };
  }

  async editTask(userId: string, args: Record<string, unknown>) {
    const taskTitle = String(args.task_title ?? '').trim();
    const field = String(args.field ?? '').trim() as 'title' | 'deadline' | 'course_name';
    const newValue = String(args.new_value ?? '').trim();

    if (!taskTitle || !field || !newValue) {
      throw new BadRequestException('task_title, field y new_value son obligatorios');
    }

    const workspaceId = await this.dataService.resolveBestStudyWorkspaceId(userId);
    if (!workspaceId) {
      throw new NotFoundException('No tienes un espacio de estudio en Mitsyy.');
    }

    const state = await this.studyService.getWorkspaceState(workspaceId, userId);
    const normalized = taskTitle.toLowerCase();
    const assignment = state.assignments.find(
      (a) =>
        a.title.toLowerCase() === normalized ||
        a.title.toLowerCase().includes(normalized) ||
        normalized.includes(a.title.toLowerCase()),
    );
    if (!assignment) {
      const names = state.assignments.slice(0, 5).map((a) => a.title).join(', ');
      throw new NotFoundException(
        `No encontré la tarea "${taskTitle}".${names ? ` Tareas: ${names}` : ''}`,
      );
    }

    const courseMap = new Map(state.courses.map((c) => [c.id, c]));
    const updateBody: Record<string, unknown> = {};

    if (field === 'title') {
      updateBody.title = newValue;
    } else if (field === 'deadline') {
      const d = new Date(newValue.includes('T') ? newValue : `${newValue}T23:59:59`);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Fecha inválida');
      }
      updateBody.deadline = d.toISOString();
    } else if (field === 'course_name') {
      const course = this.dataService.findCourseByName(state.courses, newValue);
      if (!course) {
        throw new NotFoundException(`No encontré el curso "${newValue}"`);
      }
      updateBody.courseId = course.id;
    } else {
      throw new BadRequestException('field debe ser title, deadline o course_name');
    }

    const updated = await this.studyService.updateAssignment(
      workspaceId,
      userId,
      assignment.id,
      updateBody,
    );

    const course = courseMap.get(updated.courseId);
    return {
      success: true,
      task: {
        title: updated.title,
        course: course?.name ?? 'Sin curso',
        deadline: new Date(updated.deadline).toLocaleDateString('es-PE', {
          timeZone: 'America/Lima',
        }),
      },
    };
  }

  async getCoursesToolPayload(userId: string): Promise<CoursesToolPayload> {
    const snapshot = await this.dataService.getSnapshot(userId);
    const courses: CourseToolItem[] = snapshot.courses.map((c) => ({
      id: c.id,
      name: c.name,
    }));

    return {
      courses,
      total: courses.length,
      sourceWorkspaceId: snapshot.workspaceId,
    };
  }

  async listCourses(userId: string, args: Record<string, unknown>) {
    const snapshot = await this.dataService.getSnapshot(userId);
    const cycleFilter = args.cycle_number ? Number(args.cycle_number) : null;

    let courses = snapshot.courses;
    if (cycleFilter) {
      courses = courses.filter((c) => c.cycleNumber === cycleFilter || c.source === 'study');
    }

    if (courses.length === 0) {
      return {
        courses: [],
        total: 0,
        message: 'No tienes cursos registrados en Mitsyy todavía.',
      };
    }

    return {
      courses: courses.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        source: c.source,
        status: c.status ?? 'active',
        cycleNumber: c.cycleNumber ?? null,
      })),
      total: courses.length,
    };
  }

  async getCurriculum(userId: string) {
    const snapshot = await this.dataService.getSnapshot(userId);
    if (snapshot.curriculum.length === 0) {
      return { courses: [], message: 'No tienes malla curricular configurada en Mitsyy.' };
    }

    const curriculum = await this.curriculumService.getCurriculum(userId);
    return {
      stats: curriculum.stats,
      totalCycles: curriculum.totalCycles,
      courses: snapshot.curriculum,
    };
  }

  async scheduleReminder(userId: string, args: Record<string, unknown>) {
    const title = String(args.title ?? '').trim();
    const remindAtRaw = String(args.remind_at ?? '').trim();
    if (!title || !remindAtRaw) {
      throw new BadRequestException('title y remind_at son obligatorios');
    }

    const remindAt = new Date(remindAtRaw);
    if (Number.isNaN(remindAt.getTime())) {
      throw new BadRequestException('remind_at inválida. Usa formato ISO, ej. 2026-06-17T09:00:00');
    }

    const workspaceId = await this.dataService.resolveBestStudyWorkspaceId(userId);
    if (!workspaceId) {
      throw new NotFoundException('No tienes un espacio de estudio en Mitsyy.');
    }

    const reminder = this.reminderRepo.create({
      workspaceId,
      userId,
      kind: 'custom',
      targetId: null,
      remindAt,
      title,
      note: args.note ? String(args.note) : null,
      done: false,
      sourceKind: 'whatsapp',
      externalRef: null,
      deliveryStatus: 'pending',
      attemptCount: 0,
    });
    const saved = await this.reminderRepo.save(reminder);

    return {
      success: true,
      reminder: {
        id: saved.id,
        title: saved.title,
        remindAt: remindAt.toLocaleString('es-PE', { timeZone: 'America/Lima' }),
        remindAtIso: remindAt.toISOString(),
        note: saved.note,
      },
    };
  }
}
