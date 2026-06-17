import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { Course } from '../study-university/entities/course.entity';
import { Semester } from '../study-university/entities/semester.entity';
import { StudyWorkspaceConfig } from '../study-university/entities/study-workspace-config.entity';
import { CurriculumCourse, type CurriculumCourseStatus } from './entities/curriculum-course.entity';
import { CurriculumPrerequisite } from './entities/curriculum-prerequisite.entity';
import { User } from '../users/entities/user.entity';
import {
  BulkImportCurriculumDto,
  CreateCurriculumCourseDto,
  ReorderCurriculumCoursesDto,
  SetCurriculumStatusDto,
  UpdateCurriculumCourseDto,
} from './dto/curriculum.dto';
import {
  buildUnlocksMap,
  computeCurriculumStats,
  computeUnlockState,
  type PrerequisiteEdge,
  wouldCreatePrerequisiteCycle,
} from './curriculum.calculations';

export interface CurriculumCourseView {
  id: string;
  userId: string;
  workspaceId: string | null;
  name: string;
  code: string | null;
  credits: number;
  cycleNumber: number;
  status: CurriculumCourseStatus;
  colorToken: string;
  notes: string | null;
  approvedAt: string | null;
  approvedGrade: string | null;
  failedAt: string | null;
  sortOrder: number;
  prerequisiteIds: string[];
  unlocksIds: string[];
  isUnlocked: boolean;
  linkedCourseId: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CurriculumService {
  constructor(
    private readonly workspacesService: WorkspacesService,
    @InjectRepository(CurriculumCourse)
    private readonly curriculumRepo: Repository<CurriculumCourse>,
    @InjectRepository(CurriculumPrerequisite)
    private readonly prereqRepo: Repository<CurriculumPrerequisite>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Semester)
    private readonly semesterRepo: Repository<Semester>,
    @InjectRepository(StudyWorkspaceConfig)
    private readonly configRepo: Repository<StudyWorkspaceConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private resolveCycleNumbers(
    user: Pick<User, 'curriculumTotalCycles'> | null,
    courseCycleNumbers: number[],
  ): { totalCycles: number; cycleNumbers: number[] } {
    const fromCourses = [...new Set(courseCycleNumbers)].sort((a, b) => a - b);
    const configured = user?.curriculumTotalCycles ?? 0;
    if (configured > 0) {
      const base = Array.from({ length: configured }, (_, i) => i + 1);
      const merged = [...new Set([...base, ...fromCourses])].sort((a, b) => a - b);
      return { totalCycles: configured, cycleNumbers: merged };
    }
    if (fromCourses.length > 0) {
      return {
        totalCycles: fromCourses[fromCourses.length - 1]!,
        cycleNumbers: fromCourses,
      };
    }
    return { totalCycles: 0, cycleNumbers: [] };
  }

  private parseCredits(value: string | number | undefined, fallback = 0): string {
    const n = value === undefined ? fallback : Number(value);
    if (!Number.isFinite(n) || n < 0) return '0.00';
    return Math.min(99, n).toFixed(2);
  }

  private creditsToNumber(value: string): number {
    return Number.parseFloat(value) || 0;
  }

  private normalizeApprovedGrade(
    status: CurriculumCourseStatus,
    grade?: string | null,
  ): string | null {
    if (status !== 'approved') return null;
    const trimmed = grade?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  private async loadEdgesForUser(userId: string): Promise<PrerequisiteEdge[]> {
    const courses = await this.curriculumRepo.find({ where: { userId }, select: ['id'] });
    const ids = courses.map((c) => c.id);
    if (ids.length === 0) return [];
    const rows = await this.prereqRepo.find({
      where: { curriculumCourseId: In(ids) },
    });
    return rows.map((r) => ({
      courseId: r.curriculumCourseId,
      prerequisiteId: r.prerequisiteCourseId,
    }));
  }

  private async replacePrerequisites(
    courseId: string,
    userId: string,
    prerequisiteIds: string[],
    excludeCourseId?: string,
  ): Promise<void> {
    const unique = [...new Set(prerequisiteIds.filter((id) => id !== courseId))];
    if (unique.length > 0) {
      const owned = await this.curriculumRepo.count({
        where: { userId, id: In(unique) },
      });
      if (owned !== unique.length) {
        throw new BadRequestException('Some prerequisite courses are invalid');
      }
    }

    const existing = await this.loadEdgesForUser(userId);
    const filtered = existing.filter(
      (e) =>
        e.courseId !== courseId &&
        (excludeCourseId == null || e.courseId !== excludeCourseId),
    );
    const candidateEdges = [
      ...filtered,
      ...unique.map((prerequisiteId) => ({ courseId, prerequisiteId })),
    ];

    if (wouldCreatePrerequisiteCycle(courseId, unique, candidateEdges)) {
      throw new BadRequestException(
        'Prerequisites would create a circular dependency',
      );
    }

    await this.prereqRepo.delete({ curriculumCourseId: courseId });
    if (unique.length > 0) {
      await this.prereqRepo.save(
        unique.map((prerequisiteId) =>
          this.prereqRepo.create({ curriculumCourseId: courseId, prerequisiteCourseId: prerequisiteId }),
        ),
      );
    }
  }

  private async findLinkedCourse(
    curriculumCourseId: string,
    userId: string,
  ): Promise<Course | null> {
    return this.courseRepo.findOne({
      where: { curriculumCourseId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  private async resolveStudyWorkspaceId(
    userId: string,
    preferredWorkspaceId?: string | null,
  ): Promise<string> {
    if (preferredWorkspaceId) {
      const ws = await this.workspacesService.findOne(preferredWorkspaceId, userId);
      if (ws.workspaceType === 'study' || ws.workspaceType === 'university') {
        return ws.id;
      }
    }
    const workspaces = await this.workspacesService.findAllByUserId(userId);
    const study = workspaces.find(
      (w) => w.workspaceType === 'study' || w.workspaceType === 'university',
    );
    if (!study) {
      throw new BadRequestException(
        'No study workspace found. Create a study workspace first.',
      );
    }
    return study.id;
  }

  private async ensureCurrentSemester(
    workspaceId: string,
    userId: string,
  ): Promise<Semester> {
    let semester = await this.semesterRepo.findOne({
      where: { workspaceId, userId, isCurrent: true },
    });
    if (semester) return semester;

    const config = await this.configRepo.findOne({ where: { workspaceId, userId } });
    const label = config?.currentSemesterLabel ?? `Semestre ${new Date().getFullYear()}`;

    semester = await this.semesterRepo.save(
      this.semesterRepo.create({
        workspaceId,
        userId,
        name: label,
        isCurrent: true,
      }),
    );
    return semester;
  }

  private async syncToActiveCourse(
    curriculum: CurriculumCourse,
    userId: string,
  ): Promise<Course> {
    const workspaceId = await this.resolveStudyWorkspaceId(
      userId,
      curriculum.workspaceId,
    );
    if (!curriculum.workspaceId) {
      curriculum.workspaceId = workspaceId;
      await this.curriculumRepo.update({ id: curriculum.id }, { workspaceId });
    }

    const semester = await this.ensureCurrentSemester(workspaceId, userId);
    const existing = await this.findLinkedCourse(curriculum.id, userId);

    if (existing) {
      await this.courseRepo.update(
        { id: existing.id },
        {
          archived: false,
          name: curriculum.name,
          code: curriculum.code,
          credits: curriculum.credits,
          colorToken: curriculum.colorToken,
          semesterId: semester.id,
        },
      );
      return (await this.courseRepo.findOne({ where: { id: existing.id } }))!;
    }

    const count = await this.courseRepo.count({ where: { workspaceId, userId } });
    return this.courseRepo.save(
      this.courseRepo.create({
        workspaceId,
        userId,
        semesterId: semester.id,
        curriculumCourseId: curriculum.id,
        name: curriculum.name,
        code: curriculum.code,
        credits: curriculum.credits,
        colorToken: curriculum.colorToken,
        courseType: 'lecture',
        sortOrder: count,
        archived: false,
      }),
    );
  }

  private async archiveLinkedCourse(curriculumCourseId: string, userId: string): Promise<void> {
    const linked = await this.findLinkedCourse(curriculumCourseId, userId);
    if (linked) {
      await this.courseRepo.update({ id: linked.id }, { archived: true });
    }
  }

  private async buildViews(userId: string): Promise<CurriculumCourseView[]> {
    const courses = await this.curriculumRepo.find({
      where: { userId },
      order: { cycleNumber: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });
    if (courses.length === 0) {
      return [];
    }

    const ids = courses.map((c) => c.id);
    const [prereqRows, linkedCourses] = await Promise.all([
      this.prereqRepo.find({ where: { curriculumCourseId: In(ids) } }),
      this.courseRepo.find({
        where: { curriculumCourseId: In(ids), userId },
        select: ['id', 'curriculumCourseId', 'archived'],
      }),
    ]);

    const prereqByCourse = new Map<string, string[]>();
    for (const row of prereqRows) {
      if (!prereqByCourse.has(row.curriculumCourseId)) {
        prereqByCourse.set(row.curriculumCourseId, []);
      }
      prereqByCourse.get(row.curriculumCourseId)!.push(row.prerequisiteCourseId);
    }

    const edges: PrerequisiteEdge[] = prereqRows.map((r) => ({
      courseId: r.curriculumCourseId,
      prerequisiteId: r.prerequisiteCourseId,
    }));
    const unlocksMap = buildUnlocksMap(edges);
    const statusById = new Map(courses.map((c) => [c.id, c.status]));

    const linkedByCurriculum = new Map<string, string>();
    for (const lc of linkedCourses) {
      if (lc.curriculumCourseId && !lc.archived) {
        linkedByCurriculum.set(lc.curriculumCourseId, lc.id);
      }
    }

    return courses.map((c) => {
      const prerequisiteIds = prereqByCourse.get(c.id) ?? [];
      return {
        id: c.id,
        userId: c.userId,
        workspaceId: c.workspaceId,
        name: c.name,
        code: c.code,
        credits: this.creditsToNumber(c.credits),
        cycleNumber: c.cycleNumber,
        status: c.status,
        colorToken: c.colorToken,
        notes: c.notes,
        approvedAt: c.approvedAt?.toISOString() ?? null,
        approvedGrade: c.approvedGrade,
        failedAt: c.failedAt?.toISOString() ?? null,
        sortOrder: c.sortOrder,
        prerequisiteIds,
        unlocksIds: unlocksMap.get(c.id) ?? [],
        isUnlocked: computeUnlockState(c.id, c.status, prerequisiteIds, statusById),
        linkedCourseId: linkedByCurriculum.get(c.id) ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });
  }

  async getCurriculum(userId: string) {
    const [courses, user] = await Promise.all([
      this.buildViews(userId),
      this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'curriculumTotalCycles'],
      }),
    ]);
    const prerequisites = courses.flatMap((c) =>
      c.prerequisiteIds.map((prerequisiteId) => ({
        courseId: c.id,
        prerequisiteId,
      })),
    );
    const stats = computeCurriculumStats(
      courses.map((c) => ({
        credits: c.credits,
        status: c.status,
        cycleNumber: c.cycleNumber,
      })),
    );
    const { totalCycles, cycleNumbers } = this.resolveCycleNumbers(
      user,
      courses.map((c) => c.cycleNumber),
    );
    return { courses, prerequisites, stats, totalCycles, cycleNumbers };
  }

  async createCourse(userId: string, dto: CreateCurriculumCourseDto) {
    const prereqIds = dto.prerequisiteIds ?? [];
    if (dto.status === 'in_progress' && prereqIds.length > 0) {
      const existing = await this.loadEdgesForUser(userId);
      const statusById = new Map(
        (await this.curriculumRepo.find({ where: { userId } })).map((c) => [
          c.id,
          c.status,
        ]),
      );
      const allApproved = prereqIds.every((id) => statusById.get(id) === 'approved');
      if (!allApproved) {
        throw new ConflictException('Prerequisites not approved');
      }
      if (
        wouldCreatePrerequisiteCycle('__new__', prereqIds, [
          ...existing,
          ...prereqIds.map((prerequisiteId) => ({
            courseId: '__new__',
            prerequisiteId,
          })),
        ])
      ) {
        throw new BadRequestException(
          'Prerequisites would create a circular dependency',
        );
      }
    }

    const count = await this.curriculumRepo.count({
      where: { userId, cycleNumber: dto.cycleNumber },
    });

    let workspaceId = dto.workspaceId ?? null;
    if (dto.status === 'in_progress') {
      workspaceId = await this.resolveStudyWorkspaceId(userId, workspaceId);
    }

    const course = await this.curriculumRepo.save(
      this.curriculumRepo.create({
        userId,
        workspaceId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        credits: this.parseCredits(dto.credits),
        cycleNumber: dto.cycleNumber,
        status: dto.status ?? 'pending',
        colorToken: dto.colorToken ?? 'violet',
        sortOrder: count,
        approvedAt: dto.status === 'approved' ? new Date() : null,
        approvedGrade: this.normalizeApprovedGrade(
          dto.status ?? 'pending',
          dto.approvedGrade,
        ),
        failedAt: dto.status === 'failed' ? new Date() : null,
      }),
    );

    if (dto.prerequisiteIds?.length) {
      await this.replacePrerequisites(course.id, userId, dto.prerequisiteIds);
    }

    if (course.status === 'in_progress') {
      await this.syncToActiveCourse(course, userId);
    }

    return this.getCurriculum(userId);
  }

  async updateCourse(userId: string, courseId: string, dto: UpdateCurriculumCourseDto) {
    const course = await this.curriculumRepo.findOne({ where: { id: courseId, userId } });
    if (!course) throw new NotFoundException('Curriculum course not found');

    if (dto.name != null) course.name = dto.name.trim();
    if (dto.code !== undefined) course.code = dto.code?.trim() || null;
    if (dto.credits !== undefined) course.credits = this.parseCredits(dto.credits);
    if (dto.cycleNumber != null) course.cycleNumber = dto.cycleNumber;
    if (dto.colorToken != null) course.colorToken = dto.colorToken;
    if (dto.notes !== undefined) course.notes = dto.notes;

    if (dto.status != null) {
      const prevStatus = course.status;
      course.status = dto.status;
      if (dto.status === 'approved') {
        course.approvedAt = course.approvedAt ?? new Date();
        course.failedAt = null;
      } else if (dto.status === 'failed') {
        course.failedAt = course.failedAt ?? new Date();
        course.approvedAt = null;
        course.approvedGrade = null;
      } else {
        course.approvedAt = null;
        course.approvedGrade = null;
        course.failedAt = null;
      }
      if (dto.status === 'in_progress' && prevStatus !== 'in_progress') {
        await this.syncToActiveCourse(course, userId);
      } else if (
        (dto.status === 'pending' || dto.status === 'failed') &&
        prevStatus === 'in_progress'
      ) {
        await this.archiveLinkedCourse(courseId, userId);
      } else if (dto.status === 'approved' && prevStatus === 'in_progress') {
        const linked = await this.findLinkedCourse(courseId, userId);
        if (linked) {
          await this.courseRepo.update({ id: linked.id }, { archived: true });
        }
      }
    }

    if (dto.approvedGrade !== undefined) {
      course.approvedGrade = this.normalizeApprovedGrade(
        course.status,
        dto.approvedGrade,
      );
    } else if (dto.status != null && dto.status !== 'approved') {
      course.approvedGrade = null;
    }

    await this.curriculumRepo.save(course);

    if (dto.prerequisiteIds !== undefined) {
      await this.replacePrerequisites(courseId, userId, dto.prerequisiteIds);
    }

    const linked = await this.findLinkedCourse(courseId, userId);
    if (linked) {
      await this.courseRepo.update(
        { id: linked.id },
        {
          name: course.name,
          code: course.code,
          credits: course.credits,
          colorToken: course.colorToken,
        },
      );
    }

    return this.getCurriculum(userId);
  }

  private async assertCourseUnlocked(
    courseId: string,
    userId: string,
  ): Promise<void> {
    const rows = await this.prereqRepo.find({
      where: { curriculumCourseId: courseId },
    });
    if (rows.length === 0) return;

    const prereqIds = rows.map((r) => r.prerequisiteCourseId);
    const prereqs = await this.curriculumRepo.find({
      where: { id: In(prereqIds), userId },
    });
    if (prereqs.some((p) => p.status !== 'approved')) {
      throw new ConflictException(
        'Prerequisites not approved. Use force=true to override.',
      );
    }
  }

  async setStatus(
    userId: string,
    courseId: string,
    dto: SetCurriculumStatusDto,
  ) {
    const course = await this.curriculumRepo.findOne({ where: { id: courseId, userId } });
    if (!course) throw new NotFoundException('Curriculum course not found');

    if (dto.status === 'in_progress' && !dto.force) {
      await this.assertCourseUnlocked(courseId, userId);
    }

    course.status = dto.status;
    course.approvedAt = dto.status === 'approved' ? new Date() : null;
    course.failedAt = dto.status === 'failed' ? new Date() : null;
    if (dto.status !== 'approved') {
      course.approvedAt = null;
      course.approvedGrade = null;
    }
    if (dto.status !== 'failed') course.failedAt = null;
    if (dto.status === 'approved') {
      course.approvedGrade = this.normalizeApprovedGrade(
        dto.status,
        dto.approvedGrade ?? course.approvedGrade,
      );
    }

    await this.curriculumRepo.save(course);

    if (dto.status === 'in_progress') {
      await this.syncToActiveCourse(course, userId);
    } else if (dto.status === 'pending' || dto.status === 'failed') {
      await this.archiveLinkedCourse(courseId, userId);
    } else if (dto.status === 'approved') {
      const linked = await this.findLinkedCourse(courseId, userId);
      if (linked) {
        await this.courseRepo.update({ id: linked.id }, { archived: true });
      }
    }

    return this.getCurriculum(userId);
  }

  async deleteCourse(userId: string, courseId: string) {
    const course = await this.curriculumRepo.findOne({ where: { id: courseId, userId } });
    if (!course) throw new NotFoundException('Curriculum course not found');
    await this.archiveLinkedCourse(courseId, userId);
    await this.curriculumRepo.delete({ id: courseId });
    return this.getCurriculum(userId);
  }

  async reorder(userId: string, dto: ReorderCurriculumCoursesDto) {
    const courses = await this.curriculumRepo.find({
      where: { userId, cycleNumber: dto.cycleNumber, id: In(dto.orderedIds) },
    });
    if (courses.length !== dto.orderedIds.length) {
      throw new BadRequestException('Some course ids are invalid for this cycle');
    }
    await Promise.all(
      dto.orderedIds.map((id, index) =>
        this.curriculumRepo.update({ id, userId }, { sortOrder: index }),
      ),
    );
    return this.getCurriculum(userId);
  }

  async bulkImport(userId: string, dto: BulkImportCurriculumDto) {
    const workspaceId = dto.workspaceId
      ? await this.resolveStudyWorkspaceId(userId, dto.workspaceId)
      : null;

    const codeToId = new Map<string, string>();

    for (const item of dto.items) {
      const count = await this.curriculumRepo.count({
        where: { userId, cycleNumber: item.cycleNumber },
      });
      const saved = await this.curriculumRepo.save(
        this.curriculumRepo.create({
          userId,
          workspaceId,
          name: item.name.trim(),
          code: item.code?.trim() || null,
          credits: this.parseCredits(item.credits),
          cycleNumber: item.cycleNumber,
          status: 'pending',
          colorToken: 'violet',
          sortOrder: count,
        }),
      );
      if (saved.code) codeToId.set(saved.code.toUpperCase(), saved.id);
      codeToId.set(saved.id, saved.id);
    }

    for (const item of dto.items) {
      if (!item.code || !item.prerequisiteCodes?.length) continue;
      const courseId = codeToId.get(item.code.toUpperCase());
      if (!courseId) continue;
      const prereqIds = item.prerequisiteCodes
        .map((c) => codeToId.get(c.trim().toUpperCase()))
        .filter((id): id is string => Boolean(id));
      if (prereqIds.length > 0) {
        await this.replacePrerequisites(courseId, userId, prereqIds);
      }
    }

    return this.getCurriculum(userId);
  }
}
