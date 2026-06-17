"use client";

import { useEffect, useId, useState } from "react";
import { BookOpen, Check, Clock, Pencil, Trash2, X, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CurriculumCourse, CurriculumStatus } from "@/app/lib/curriculum/types";
import { STATUS_BUTTON_CLASSES } from "@/app/lib/curriculum/types";
import { cycleToRoman } from "@/app/lib/curriculum/curriculum-utils";
import type { StudentGradeScale } from "@/lib/student-grade-scale";
import { STUDENT_MODAL_PANEL } from "../../components/student-modal-classes";
import { ApprovedGradeField } from "./ApprovedGradeField";
import { cn } from "@/lib/utils";

interface MallaCourseDetailProps {
  course: CurriculumCourse;
  getCourseById: (id: string) => CurriculumCourse | null;
  gradeScale?: StudentGradeScale | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (
    status: CurriculumStatus,
    options?: { force?: boolean; approvedGrade?: string },
  ) => void;
  onApprovedGradeChange?: (approvedGrade: string) => void;
}

const STATUS_OPTIONS: {
  status: CurriculumStatus;
  icon: typeof Clock;
}[] = [
  { status: "pending", icon: Clock },
  { status: "in_progress", icon: BookOpen },
  { status: "approved", icon: Check },
  { status: "failed", icon: XCircle },
];

export function MallaCourseDetail({
  course,
  getCourseById,
  gradeScale,
  open,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onApprovedGradeChange,
}: MallaCourseDetailProps) {
  const t = useTranslations("studentMalla");
  const uid = useId();
  const [approvedGradeDraft, setApprovedGradeDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setApprovedGradeDraft(course.approvedGrade ?? "");
  }, [open, course.id, course.approvedGrade]);

  if (!open) return null;

  const prereqs = course.prerequisiteIds
    .map((id) => getCourseById(id))
    .filter(Boolean) as CurriculumCourse[];
  const unlocks = course.unlocksIds
    .map((id) => getCourseById(id))
    .filter(Boolean) as CurriculumCourse[];
  const locked = !course.isUnlocked && course.status === "pending";

  const handleStatusClick = (status: CurriculumStatus) => {
    if (status === "in_progress" && locked) {
      onStatusChange(status, { force: true });
      return;
    }
    if (status === "approved") {
      onStatusChange(status, {
        approvedGrade: approvedGradeDraft.trim() || undefined,
      });
      return;
    }
    onStatusChange(status);
  };

  const handleApprovedGradeBlur = () => {
    if (course.status !== "approved" || !onApprovedGradeChange) return;
    const next = approvedGradeDraft.trim();
    const current = course.approvedGrade?.trim() ?? "";
    if (next === current) return;
    onApprovedGradeChange(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("cancel")}
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          STUDENT_MODAL_PANEL,
          "relative z-10 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="pr-8 text-xl font-semibold text-[var(--text-primary)]">{course.name}</h2>
        <p className="mt-1 text-sm text-[var(--text-body)]">
          {[course.code, `${course.credits} ${t("creditsUnit")}`, t("cycleLabel", { roman: cycleToRoman(course.cycleNumber) })]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {locked && (
          <p className="mt-3 rounded-lg border border-[var(--malla-alert-border)] bg-[var(--malla-alert-bg)] px-3 py-2 text-xs font-medium text-[var(--malla-alert-fg)]">
            {t("blockedTooltip", {
              names: prereqs.filter((p) => p.status !== "approved").map((p) => p.name).join(", "),
            })}
          </p>
        )}

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-body)]">
            {t("stateSection")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUS_OPTIONS.map(({ status, icon: Icon }) => (
              <button
                key={status}
                type="button"
                disabled={status === "in_progress" && locked}
                onClick={() => handleStatusClick(status)}
                className={cn(
                  "flex cursor-pointer select-none flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition active:scale-[0.98]",
                  STATUS_BUTTON_CLASSES[status],
                  course.status === status && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-surface)]",
                  status === "in_progress" && locked && "opacity-50",
                )}
              >
                <Icon className="h-5 w-5" />
                {t(`status_${status}`)}
              </button>
            ))}
          </div>
          {locked && (
            <button
              type="button"
              onClick={() => onStatusChange("in_progress", { force: true })}
              className="mt-2 text-xs text-[var(--accent)] underline"
            >
              {t("forceUnlock")}
            </button>
          )}
          <ApprovedGradeField
            id={`${uid}-approved-grade`}
            label={t("formApprovedGrade")}
            hint={t("formApprovedGradeHint")}
            gradeScale={gradeScale}
            value={approvedGradeDraft}
            onChange={setApprovedGradeDraft}
            onBlur={handleApprovedGradeBlur}
            className="mt-4"
          />
        </div>

        {prereqs.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-body)]">
              {t("prereqs")}
            </p>
            <ul className="space-y-1.5">
              {prereqs.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs font-medium text-[var(--text-body)]">
                    {t(`status_${p.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unlocks.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-body)]">
              {t("unlocks")}
            </p>
            <ul className="space-y-1.5">
              {unlocks.map((u) => (
                <li
                  key={u.id}
                  className="rounded-lg bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {u.name}
                  {u.code ? ` (${u.code})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-primary)]"
          >
            <Pencil className="h-4 w-4" />
            {t("edit")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--malla-status-failed-ring)] bg-[var(--malla-status-failed-bg)] px-4 py-2.5 text-[var(--malla-status-failed-fg)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
