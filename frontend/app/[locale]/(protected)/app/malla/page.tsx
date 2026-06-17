"use client";

import { useCallback, useState } from "react";
import { GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/app/lib/toast";
import { useAuth } from "@/app/providers/auth-provider";
import { useCurriculum } from "@/app/lib/curriculum/hooks";
import { fireConfetti } from "@/app/lib/curriculum/confetti";
import type { CurriculumCourse, CurriculumStatus } from "@/app/lib/curriculum/types";
import { StudentPageShell } from "../components/StudentPageShell";
import { ConfirmDestructiveModal } from "../components/ConfirmDestructiveModal";
import { MallaHeader } from "./components/MallaHeader";
import { MallaGrid } from "./components/MallaGrid";
import { MallaStatsPanel } from "./components/MallaStatsPanel";
import { MallaCourseDetail } from "./components/MallaCourseDetail";
import { MallaCourseForm, type MallaCourseFormValues } from "./components/MallaCourseForm";
import { MallaSkeleton } from "./components/MallaSkeleton";

function prereqIdsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

export default function MallaPage() {
  const t = useTranslations("studentMalla");
  const { token, user } = useAuth();
  const {
    state,
    loading,
    error,
    load,
    createCourse,
    updateCourse,
    setStatus,
    removeCourse,
    coursesByCycle,
    cycleNumbers,
    totalCycles,
    getCourseById,
  } = useCurriculum();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCourse = selectedId ? getCourseById(selectedId) : null;
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<CurriculumCourse | null>(null);
  const [deleting, setDeleting] = useState<CurriculumCourse | null>(null);

  const toastStatusDesc = useCallback(
    (status: CurriculumStatus, courseName: string) => {
      switch (status) {
        case "pending":
          return t("toastStatusPendingDesc", { name: courseName });
        case "in_progress":
          return t("toastStatusInProgressDesc", { name: courseName });
        case "approved":
          return t("toastStatusApprovedDesc", { name: courseName });
        case "failed":
          return t("toastStatusFailedDesc", { name: courseName });
      }
    },
    [t],
  );

  const handleStatusChange = useCallback(
    async (
      status: CurriculumStatus,
      options?: { force?: boolean; approvedGrade?: string },
    ) => {
      if (!selectedId || !selectedCourse) return;
      const courseName = selectedCourse.name;
      if (status === "approved") {
        fireConfetti();
      }
      try {
        await setStatus(selectedId, status, options);
        toast.success(t("toastStatusChangedTitle"), toastStatusDesc(status, courseName));
      } catch (e) {
        toast.error(
          t("toastErrorTitle"),
          e instanceof Error ? e.message : t("errorLoad"),
        );
      }
    },
    [selectedId, selectedCourse, setStatus, t, toastStatusDesc],
  );

  const handleApprovedGradeChange = useCallback(
    async (approvedGrade: string) => {
      if (!selectedId || !selectedCourse || selectedCourse.status !== "approved") return;
      try {
        await updateCourse(selectedId, { approvedGrade });
        toast.success(t("toastCourseUpdatedTitle"), t("toastApprovedGradeUpdatedDesc"));
      } catch (e) {
        toast.error(
          t("toastErrorTitle"),
          e instanceof Error ? e.message : t("errorLoad"),
        );
      }
    },
    [selectedId, selectedCourse, updateCourse, t],
  );

  const handleFormSubmit = useCallback(
    async (values: MallaCourseFormValues) => {
      try {
        if (formMode === "edit" && editing) {
          const prereqsChanged = !prereqIdsEqual(
            editing.prerequisiteIds,
            values.prerequisiteIds,
          );
          await updateCourse(editing.id, {
            name: values.name,
            code: values.code || undefined,
            credits: values.credits,
            cycleNumber: values.cycleNumber,
            colorToken: values.colorToken,
            prerequisiteIds: values.prerequisiteIds,
            status: values.status,
            approvedGrade:
              values.status === "approved" ? values.approvedGrade || undefined : undefined,
          });
          if (prereqsChanged) {
            toast.success(
              t("toastCourseUpdatedTitle"),
              t("toastPrereqsUpdatedDesc", { count: values.prerequisiteIds.length }),
            );
          } else {
            toast.success(
              t("toastCourseUpdatedTitle"),
              t("toastCourseUpdatedDesc", { name: values.name }),
            );
          }
        } else {
          await createCourse({
            name: values.name,
            code: values.code || undefined,
            credits: values.credits,
            cycleNumber: values.cycleNumber,
            colorToken: values.colorToken,
            prerequisiteIds: values.prerequisiteIds,
            status: values.status,
            approvedGrade:
              values.status === "approved" ? values.approvedGrade || undefined : undefined,
          });
          if (values.status === "approved") {
            fireConfetti();
          }
          toast.success(
            t("toastCourseCreatedTitle"),
            t("toastCourseCreatedDesc", { name: values.name }),
          );
        }
      } catch (e) {
        toast.error(
          t("toastErrorTitle"),
          e instanceof Error ? e.message : t("errorLoad"),
        );
        throw e;
      }
    },
    [formMode, editing, updateCourse, createCourse, t],
  );

  if (!token) {
    return (
      <StudentPageShell title={t("title")} maxWidth="max-w-7xl">
        <p className="text-[var(--text-muted)]">{t("loginRequired")}</p>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title={t("title")} maxWidth="max-w-7xl">
      <MallaHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddCourse={() => {
          setFormMode("create");
          setEditing(null);
          setFormOpen(true);
        }}
      />

      {loading && <MallaSkeleton />}

      {error && !loading && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 text-[var(--accent)] underline">
            {t("retry")}
          </button>
        </div>
      )}

      {!loading && !error && state && (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            {state.courses.length === 0 && totalCycles === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] py-20 text-center">
                <GraduationCap className="mb-4 h-12 w-12 text-[var(--accent)] opacity-60" />
                <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
                <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">{t("emptySubtitle")}</p>
              </div>
            ) : (
              <MallaGrid
                coursesByCycle={coursesByCycle}
                cycleNumbers={cycleNumbers}
                searchQuery={searchQuery}
                getCourseById={getCourseById}
                onSelectCourse={(c) => setSelectedId(c.id)}
              />
            )}
          </div>

          <MallaStatsPanel stats={state.stats} courses={state.courses} />
        </div>
      )}

      {selectedCourse && (
        <MallaCourseDetail
          course={selectedCourse}
          getCourseById={getCourseById}
          gradeScale={user?.studentProfile?.gradeScale}
          open
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setFormMode("edit");
            setEditing(selectedCourse);
            setFormOpen(true);
          }}
          onDelete={() => setDeleting(selectedCourse)}
          onStatusChange={handleStatusChange}
          onApprovedGradeChange={handleApprovedGradeChange}
        />
      )}

      <MallaCourseForm
        open={formOpen}
        mode={formMode}
        initial={editing}
        allCourses={state?.courses ?? []}
        defaultCycle={cycleNumbers[0] ?? 1}
        maxCycle={totalCycles > 0 ? totalCycles : 12}
        gradeScale={user?.studentProfile?.gradeScale}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDestructiveModal
        open={deleting != null}
        title={t("deleteConfirmTitle")}
        message={deleting ? t("deleteConfirmMessage", { name: deleting.name }) : ""}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const name = deleting.name;
          try {
            await removeCourse(deleting.id);
            setDeleting(null);
            setSelectedId(null);
            toast.success(t("toastCourseDeletedTitle"), t("toastCourseDeletedDesc"));
          } catch (e) {
            toast.error(
              t("toastErrorTitle"),
              e instanceof Error ? e.message : t("errorLoad"),
            );
          }
        }}
      />
    </StudentPageShell>
  );
}
