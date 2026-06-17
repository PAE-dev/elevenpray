import type { CourseColorToken } from "../study-university/types";

export type { CourseColorToken };

export type CurriculumStatus = "pending" | "in_progress" | "approved" | "failed";

export interface CurriculumCourse {
  id: string;
  userId: string;
  workspaceId: string | null;
  name: string;
  code: string | null;
  credits: number;
  cycleNumber: number;
  status: CurriculumStatus;
  colorToken: CourseColorToken;
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

export interface CurriculumPrerequisiteEdge {
  courseId: string;
  prerequisiteId: string;
}

export interface CurriculumStats {
  totalCourses: number;
  approvedCount: number;
  inProgressCount: number;
  pendingCount: number;
  failedCount: number;
  totalCredits: number;
  approvedCredits: number;
  progressPercent: number;
  cyclesWithCourses: number;
}

export interface CurriculumState {
  courses: CurriculumCourse[];
  prerequisites: CurriculumPrerequisiteEdge[];
  stats: CurriculumStats;
  totalCycles: number;
  cycleNumbers: number[];
}

export interface CreateCurriculumCourseInput {
  name: string;
  code?: string;
  credits?: number;
  cycleNumber: number;
  colorToken?: CourseColorToken;
  workspaceId?: string;
  prerequisiteIds?: string[];
  status?: CurriculumStatus;
  approvedGrade?: string;
}

export interface UpdateCurriculumCourseInput {
  name?: string;
  code?: string;
  credits?: number;
  cycleNumber?: number;
  colorToken?: CourseColorToken;
  notes?: string;
  status?: CurriculumStatus;
  approvedGrade?: string;
  prerequisiteIds?: string[];
}

export const CURRICULUM_COLOR_TOKENS: CourseColorToken[] = [
  "blue",
  "violet",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "indigo",
  "teal",
];

/** Clases de tarjeta por color — usan CSS vars con contraste en light/dark */
export const COLOR_TOKEN_CLASSES: Record<CourseColorToken, string> = {
  blue: "border-[var(--malla-card-blue-border)] bg-[var(--malla-card-blue-bg)]",
  violet: "border-[var(--malla-card-violet-border)] bg-[var(--malla-card-violet-bg)]",
  emerald: "border-[var(--malla-card-emerald-border)] bg-[var(--malla-card-emerald-bg)]",
  amber: "border-[var(--malla-card-amber-border)] bg-[var(--malla-card-amber-bg)]",
  rose: "border-[var(--malla-card-rose-border)] bg-[var(--malla-card-rose-bg)]",
  cyan: "border-[var(--malla-card-cyan-border)] bg-[var(--malla-card-cyan-bg)]",
  indigo: "border-[var(--malla-card-indigo-border)] bg-[var(--malla-card-indigo-bg)]",
  teal: "border-[var(--malla-card-teal-border)] bg-[var(--malla-card-teal-bg)]",
};

export const COLOR_TOKEN_META_CLASS: Record<CourseColorToken, string> = {
  blue: "text-[var(--malla-card-blue-meta)]",
  violet: "text-[var(--malla-card-violet-meta)]",
  emerald: "text-[var(--malla-card-emerald-meta)]",
  amber: "text-[var(--malla-card-amber-meta)]",
  rose: "text-[var(--malla-card-rose-meta)]",
  cyan: "text-[var(--malla-card-cyan-meta)]",
  indigo: "text-[var(--malla-card-indigo-meta)]",
  teal: "text-[var(--malla-card-teal-meta)]",
};

export const STATUS_STYLES: Record<
  CurriculumStatus,
  { bg: string; text: string; ring: string }
> = {
  pending: {
    bg: "bg-[var(--malla-status-pending-bg)]",
    text: "text-[var(--malla-status-pending-fg)]",
    ring: "ring-[var(--malla-status-pending-ring)]",
  },
  in_progress: {
    bg: "bg-[var(--malla-status-progress-bg)]",
    text: "text-[var(--malla-status-progress-fg)]",
    ring: "ring-[var(--malla-status-progress-ring)]",
  },
  approved: {
    bg: "bg-[var(--malla-status-approved-bg)]",
    text: "text-[var(--malla-status-approved-fg)]",
    ring: "ring-[var(--malla-status-approved-ring)]",
  },
  failed: {
    bg: "bg-[var(--malla-status-failed-bg)]",
    text: "text-[var(--malla-status-failed-fg)]",
    ring: "ring-[var(--malla-status-failed-ring)]",
  },
};

/** Botones de estado en modal de detalle */
export const STATUS_BUTTON_CLASSES: Record<CurriculumStatus, string> = {
  pending:
    "border-[var(--malla-status-pending-ring)] bg-[var(--malla-status-pending-bg)] text-[var(--malla-status-pending-fg)]",
  in_progress:
    "border-[var(--malla-status-progress-ring)] bg-[var(--malla-status-progress-bg)] text-[var(--malla-status-progress-fg)]",
  approved:
    "border-[var(--malla-status-approved-ring)] bg-[var(--malla-status-approved-bg)] text-[var(--malla-status-approved-fg)]",
  failed:
    "border-[var(--malla-status-failed-ring)] bg-[var(--malla-status-failed-bg)] text-[var(--malla-status-failed-fg)]",
};
