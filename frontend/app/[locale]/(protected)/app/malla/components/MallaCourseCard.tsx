"use client";

import { memo } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CurriculumCourse } from "@/app/lib/curriculum/types";
import {
  COLOR_TOKEN_CLASSES,
  COLOR_TOKEN_META_CLASS,
  STATUS_STYLES,
} from "@/app/lib/curriculum/types";

interface MallaCourseCardProps {
  course: CurriculumCourse;
  blockedNames?: string[];
  onClick: () => void;
}

function MallaCourseCardInner({ course, blockedNames = [], onClick }: MallaCourseCardProps) {
  const t = useTranslations("studentMalla");
  const locked = !course.isUnlocked && course.status === "pending";
  const statusStyle = STATUS_STYLES[course.status];
  const colorClass = COLOR_TOKEN_CLASSES[course.colorToken];

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        locked && blockedNames.length > 0
          ? t("blockedTooltip", { names: blockedNames.join(", ") })
          : undefined
      }
      className={cn(
        "group relative flex min-h-[108px] w-full min-w-[140px] max-w-[200px] flex-col rounded-2xl border p-3 text-left shadow-sm transition-[box-shadow,transform,opacity] duration-150",
        colorClass,
        locked
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:shadow-md hover:shadow-black/10 active:scale-[0.98] dark:hover:shadow-black/25",
        course.status === "approved" && "ring-1 ring-[var(--malla-status-approved-ring)]",
        course.status === "in_progress" && "ring-1 ring-[var(--malla-status-progress-ring)]",
      )}
    >
      {locked && (
        <span className="absolute right-2 top-2 text-[var(--malla-locked-icon)]">
          <Lock className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      {course.code && (
        <span
          className={cn(
            "text-[10px] font-semibold tracking-wide",
            COLOR_TOKEN_META_CLASS[course.colorToken],
          )}
        >
          {course.code}
        </span>
      )}
      <span className="mt-1 line-clamp-2 flex-1 text-xs font-semibold uppercase leading-tight text-[var(--text-primary)]">
        {course.name}
      </span>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span
          className={cn(
            "text-[10px] font-medium",
            COLOR_TOKEN_META_CLASS[course.colorToken],
          )}
        >
          {course.credits} {t("creditsUnit")}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1",
            statusStyle.bg,
            statusStyle.text,
            statusStyle.ring,
          )}
        >
          {course.status === "approved" && course.approvedGrade
            ? `${t(`status_${course.status}`)} · ${course.approvedGrade}`
            : t(`status_${course.status}`)}
        </span>
      </div>
    </button>
  );
}

export const MallaCourseCard = memo(MallaCourseCardInner);
