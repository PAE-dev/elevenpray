import { getAuthHeaders, getBaseUrl } from "../api";
import type {
  CreateCurriculumCourseInput,
  CurriculumCourse,
  CurriculumState,
  CurriculumStats,
  CurriculumStatus,
  UpdateCurriculumCourseInput,
} from "./types";

const baseUrl = () => `${getBaseUrl()}/curriculum`;

function parseNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCourse(raw: Record<string, unknown>): CurriculumCourse {
  return {
    id: String(raw.id),
    userId: String(raw.userId ?? raw.user_id),
    workspaceId: (raw.workspaceId ?? raw.workspace_id ?? null) as string | null,
    name: String(raw.name ?? ""),
    code: (raw.code ?? null) as string | null,
    credits: parseNumber(raw.credits),
    cycleNumber: Number(raw.cycleNumber ?? raw.cycle_number ?? 1),
    status: (raw.status ?? "pending") as CurriculumStatus,
    colorToken: (raw.colorToken ?? raw.color_token ?? "violet") as CurriculumCourse["colorToken"],
    notes: (raw.notes ?? null) as string | null,
    approvedAt: (raw.approvedAt ?? raw.approved_at ?? null) as string | null,
    approvedGrade: (raw.approvedGrade ?? raw.approved_grade ?? null) as string | null,
    failedAt: (raw.failedAt ?? raw.failed_at ?? null) as string | null,
    sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0),
    prerequisiteIds: (raw.prerequisiteIds ?? raw.prerequisite_ids ?? []) as string[],
    unlocksIds: (raw.unlocksIds ?? raw.unlocks_ids ?? []) as string[],
    isUnlocked: Boolean(raw.isUnlocked ?? raw.is_unlocked ?? true),
    linkedCourseId: (raw.linkedCourseId ?? raw.linked_course_id ?? null) as string | null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ""),
  };
}

function normalizeStats(raw: Record<string, unknown>): CurriculumStats {
  return {
    totalCourses: Number(raw.totalCourses ?? raw.total_courses ?? 0),
    approvedCount: Number(raw.approvedCount ?? raw.approved_count ?? 0),
    inProgressCount: Number(raw.inProgressCount ?? raw.in_progress_count ?? 0),
    pendingCount: Number(raw.pendingCount ?? raw.pending_count ?? 0),
    failedCount: Number(raw.failedCount ?? raw.failed_count ?? 0),
    totalCredits: parseNumber(raw.totalCredits ?? raw.total_credits),
    approvedCredits: parseNumber(raw.approvedCredits ?? raw.approved_credits),
    progressPercent: Number(raw.progressPercent ?? raw.progress_percent ?? 0),
    cyclesWithCourses: Number(raw.cyclesWithCourses ?? raw.cycles_with_courses ?? 0),
  };
}

function normalizeState(data: Record<string, unknown>): CurriculumState {
  const courses = Array.isArray(data.courses)
    ? (data.courses as Record<string, unknown>[]).map(normalizeCourse)
    : [];
  const prerequisites = Array.isArray(data.prerequisites)
    ? (data.prerequisites as Record<string, unknown>[]).map((p) => ({
        courseId: String(p.courseId ?? p.course_id),
        prerequisiteId: String(p.prerequisiteId ?? p.prerequisite_id),
      }))
    : [];
  const stats = normalizeStats((data.stats as Record<string, unknown>) ?? {});
  const fromApi = Array.isArray(data.cycleNumbers ?? data.cycle_numbers)
    ? (data.cycleNumbers ?? data.cycle_numbers) as unknown[]
    : [];
  const cycleNumbersFromApi = fromApi
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1);
  const courseCycles = [...new Set(courses.map((c) => c.cycleNumber))].sort((a, b) => a - b);
  const totalCycles = Number(data.totalCycles ?? data.total_cycles ?? 0);
  const cycleNumbers =
    cycleNumbersFromApi.length > 0
      ? cycleNumbersFromApi
      : courseCycles.length > 0
        ? courseCycles
        : totalCycles > 0
          ? Array.from({ length: totalCycles }, (_, i) => i + 1)
          : [];
  return {
    courses,
    prerequisites,
    stats,
    totalCycles: totalCycles > 0 ? totalCycles : cycleNumbers.length > 0 ? cycleNumbers[cycleNumbers.length - 1]! : 0,
    cycleNumbers,
  };
}

async function handleResponse(res: Response): Promise<CurriculumState> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message =
      (err as { message?: string | string[] }).message ??
      `Error ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
  }
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeState(data);
}

export async function fetchCurriculum(token: string): Promise<CurriculumState> {
  const res = await fetch(baseUrl(), {
    headers: getAuthHeaders(token),
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function createCurriculumCourse(
  token: string,
  body: CreateCurriculumCourseInput,
): Promise<CurriculumState> {
  const res = await fetch(`${baseUrl()}/courses`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function updateCurriculumCourse(
  token: string,
  courseId: string,
  body: UpdateCurriculumCourseInput,
): Promise<CurriculumState> {
  const res = await fetch(`${baseUrl()}/courses/${courseId}`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function setCurriculumCourseStatus(
  token: string,
  courseId: string,
  status: CurriculumStatus,
  options?: { force?: boolean; approvedGrade?: string },
): Promise<CurriculumState> {
  const res = await fetch(`${baseUrl()}/courses/${courseId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify({
      status,
      force: options?.force,
      approvedGrade: options?.approvedGrade,
    }),
  });
  return handleResponse(res);
}

export async function deleteCurriculumCourse(
  token: string,
  courseId: string,
): Promise<CurriculumState> {
  const res = await fetch(`${baseUrl()}/courses/${courseId}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });
  return handleResponse(res);
}

export async function reorderCurriculumCourses(
  token: string,
  cycleNumber: number,
  orderedIds: string[],
): Promise<CurriculumState> {
  const res = await fetch(`${baseUrl()}/courses/reorder`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ cycleNumber, orderedIds }),
  });
  return handleResponse(res);
}

export async function importCurriculum(
  token: string,
  items: Array<{
    cycleNumber: number;
    code?: string;
    name: string;
    credits?: number;
    prerequisiteCodes?: string[];
  }>,
  workspaceId?: string,
): Promise<CurriculumState> {
  const res = await fetch(`${baseUrl()}/import`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ items, workspaceId }),
  });
  return handleResponse(res);
}
