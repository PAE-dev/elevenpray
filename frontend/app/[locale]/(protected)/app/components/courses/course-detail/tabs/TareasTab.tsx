"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGamification } from "../../../../gamification/gamification-context";
import { NewTaskModal } from "../../../../tasks/components/NewTaskModal";
import { TasksCourseTabSkeleton } from "../../../../tasks/components/TasksSkeleton";
import { useStudentTasks } from "../../../../tasks/context/student-tasks-context";
import type { StudentTask } from "../../../../tasks/lib/task-types";
import { courseHex } from "../course-detail-utils";
import type { MockCourseExtended } from "../../../../lib/mock-course-data";

type Filter = "todas" | "pendientes" | "completadas";

interface TareasTabProps {
  course: MockCourseExtended;
}

const PRIORITY_CLASS = {
  alta: "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]",
  media: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]",
  baja: "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)]",
};

const STATUS_CLASS = {
  pending: "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-muted)]",
  in_progress:
    "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]",
  done: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]",
};

const STATUS_LABEL = {
  pending: "Pendiente",
  in_progress: "En progreso",
  done: "Completada",
};

export function TareasTab({ course }: TareasTabProps) {
  const hex = courseHex(course);
  const { getTasksForCourse, setStatus, setProgress, deleteTask, resolveServerCourseId, loading } =
    useStudentTasks();
  const { recordActivity } = useGamification();
  const [filter, setFilter] = useState<Filter>("todas");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudentTask | null>(null);

  const list = getTasksForCourse(course.id);
  const serverCourseId = resolveServerCourseId(course.id) ?? course.id;

  const filtered = useMemo(() => {
    return list.filter((t) => {
      if (filter === "todas") return true;
      if (filter === "pendientes") return t.status !== "done";
      return t.status === "done";
    });
  }, [list, filter]);

  async function toggleDone(task: StudentTask) {
    const nextDone = task.status !== "done";
    await setStatus(task.assignmentId, nextDone ? "done" : "pending");
    if (nextDone) void recordActivity("tasks");
  }

  if (loading) {
    return <TasksCourseTabSkeleton />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Tareas del curso
        </h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          + Nueva tarea
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["todas", "pendientes", "completadas"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
          >
            {f === "todas" ? "Todas" : f === "pendientes" ? "Pendientes" : "Completadas"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          No hay tareas en este curso. Crea la primera.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((task) => {
            const done = task.status === "done";
            const exp = expandedId === task.id;
            const prog = task.progress;
            return (
              <motion.li
                key={task.id}
                layout
                className={cn(
                  "overflow-hidden rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border)] bg-[var(--bg-surface)] transition-[border-color] duration-150 hover:border-l-[3px]",
                )}
                style={{ borderLeftColor: exp ? hex : undefined }}
              >
                <div className="flex items-stretch gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => void toggleDone(task)}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-150",
                      done
                        ? "scale-95 border-[var(--success)] bg-[var(--success)]"
                        : "border-[var(--border-strong)] bg-transparent",
                    )}
                    aria-pressed={done}
                  >
                    {done ? <span className="h-2 w-2 rounded-sm bg-[var(--accent-fg)]" /> : null}
                  </button>
                  <div className={cn("min-w-0 flex-1", done && "opacity-60")}>
                    <p className={cn("font-semibold text-[var(--text-primary)]", done && "line-through")}>
                      {task.title}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <CalendarDays className="h-3 w-3" aria-hidden />
                      {task.dueDateLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "rounded-full border-[0.5px] px-2 py-0.5 text-[10px] font-medium",
                        PRIORITY_CLASS[task.priority],
                      )}
                    >
                      {task.priority === "alta" ? "Alta" : task.priority === "media" ? "Media" : "Baja"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border-[0.5px] px-2 py-0.5 text-[10px] font-medium",
                        STATUS_CLASS[task.status],
                      )}
                    >
                      {STATUS_LABEL[task.status]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(exp ? null : task.id)}
                    className="self-center p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-expanded={exp}
                  >
                    <ChevronRight className={cn("h-5 w-5 transition-transform", exp && "rotate-90")} />
                  </button>
                </div>
                {exp && (
                  <div className="border-t-[0.5px] border-[var(--border)] px-3 pb-3 pt-2">
                    <p className="text-sm text-[var(--text-body)]">
                      {task.description || "Sin descripción."}
                    </p>
                    <p className="mb-2 mt-3 text-xs text-[var(--text-muted)]">Progreso</p>
                    <div className="flex flex-wrap gap-2">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => void setProgress(task.assignmentId, p)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[10px] font-medium",
                            prog === p
                              ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                              : "bg-[var(--bg-input)] text-[var(--text-muted)]",
                          )}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--bg-input)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${prog}%` }} />
                    </div>
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingTask(task)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--text-primary)] hover:underline"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTask(task.assignmentId)}
                        className="text-xs text-[var(--error)] hover:underline"
                      >
                        Eliminar tarea
                      </button>
                    </div>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}

      <NewTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultCourseId={serverCourseId}
        lockCourse
      />

      <NewTaskModal
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        lockCourse
      />
    </div>
  );
}
