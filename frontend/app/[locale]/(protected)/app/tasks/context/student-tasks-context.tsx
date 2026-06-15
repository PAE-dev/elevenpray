"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/app/providers/auth-provider";
import {
  createUniversityAssignment,
  deleteUniversityAssignment,
  updateUniversityAssignment,
} from "@/app/lib/study-university/api";
import { useStudyUniversity } from "@/app/lib/study-university/hooks";
import type { AssignmentStatus, Course } from "@/app/lib/study-university/types";
import { useStudyBackendLink } from "../../lib/study-backend-link";
import {
  mapAssignmentToStudentTask,
  priorityToBackend,
  statusToBackend,
} from "../lib/map-assignment";
import type { StudentTask, TaskFilterId, TaskPriority, TaskStatus } from "../lib/task-types";

export type CreateTaskInput = {
  courseId: string;
  title: string;
  description?: string;
  deadline: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  progressPercent?: number;
  classSessionId?: string | null;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  deadline?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  progressPercent?: number;
  classSessionId?: string | null;
};

type StudentTasksContextValue = {
  tasks: StudentTask[];
  filteredTasks: StudentTask[];
  courses: Course[];
  workspaceId: string | null;
  loading: boolean;
  ensuringWorkspace: boolean;
  error: string | null;
  searchQuery: string;
  activeFilter: TaskFilterId;
  setSearchQuery: (q: string) => void;
  setActiveFilter: (f: TaskFilterId) => void;
  refresh: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<string | undefined>;
  updateTask: (assignmentId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (assignmentId: string) => Promise<void>;
  setStatus: (assignmentId: string, status: TaskStatus) => Promise<void>;
  setProgress: (assignmentId: string, progress: number) => Promise<void>;
  getTasksForCourse: (courseId: string) => StudentTask[];
  getTasksForSession: (classSessionId: string) => StudentTask[];
  resolveServerCourseId: (localOrServerId: string) => string | null;
};

const StudentTasksContext = createContext<StudentTasksContextValue | null>(null);

export function StudentTasksProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const { token } = useAuth();
  const {
    workspaceId,
    ensuringWorkspace,
    ensureWorkspace,
    courseMap,
    error: linkError,
  } = useStudyBackendLink(token);
  const study = useStudyUniversity(workspaceId ?? "", token);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TaskFilterId>("all");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    const ws = await ensureWorkspace({ force: true });
    if (ws) await study.load();
  }, [token, ensureWorkspace, study]);

  const loadState = study.load;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) {
        setReady(true);
        return;
      }
      const ws = await ensureWorkspace();
      if (cancelled || !ws) {
        if (!cancelled) setReady(true);
        return;
      }
      // Tras invalidar un UUID obsoleto, esperar al re-render con el id nuevo
      if (workspaceId !== ws) return;
      await loadState();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, workspaceId, ensureWorkspace, loadState]);

  const courseById = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of study.state.courses) map.set(c.id, c);
    return map;
  }, [study.state.courses]);

  const tasks = useMemo(() => {
    return study.state.assignments.map((a) =>
      mapAssignmentToStudentTask(a, courseById.get(a.courseId), locale),
    );
  }, [study.state.assignments, courseById, locale]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.courseCode.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    if (activeFilter === "all") return list;
    if (activeFilter === "pending" || activeFilter === "in_progress" || activeFilter === "done") {
      return list.filter((t) => t.status === activeFilter);
    }
    return list.filter((t) => t.priority === activeFilter);
  }, [tasks, searchQuery, activeFilter]);

  const resolveServerCourseId = useCallback(
    (localOrServerId: string): string | null => {
      if (courseById.has(localOrServerId)) return localOrServerId;
      return courseMap[localOrServerId] ?? null;
    },
    [courseById, courseMap],
  );

  const getTasksForCourse = useCallback(
    (courseId: string) => {
      const serverId = resolveServerCourseId(courseId) ?? courseId;
      return tasks.filter((t) => t.courseId === serverId);
    },
    [tasks, resolveServerCourseId],
  );

  const getTasksForSession = useCallback(
    (classSessionId: string) => tasks.filter((t) => t.classSessionId === classSessionId),
    [tasks],
  );

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<string | undefined> => {
      if (!token || !workspaceId) return undefined;
      const serverCourseId = resolveServerCourseId(input.courseId) ?? input.courseId;
      const assignment = await createUniversityAssignment(token, workspaceId, {
        courseId: serverCourseId,
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        priority: input.priority ? priorityToBackend(input.priority) : "medium",
        status: input.status ? statusToBackend(input.status) : "pending",
        progressPercent: input.progressPercent ?? 0,
        classSessionId: input.classSessionId ?? undefined,
      });
      study.upsertAssignmentInState(assignment);
      return assignment.id;
    },
    [token, workspaceId, resolveServerCourseId, study],
  );

  const updateTask = useCallback(
    async (assignmentId: string, input: UpdateTaskInput) => {
      if (!token || !workspaceId) return;
      const body: Record<string, unknown> = {};
      if (input.title !== undefined) body.title = input.title;
      if (input.description !== undefined) body.description = input.description;
      if (input.deadline !== undefined) body.deadline = input.deadline;
      if (input.priority !== undefined) body.priority = priorityToBackend(input.priority);
      if (input.status !== undefined) body.status = statusToBackend(input.status);
      if (input.progressPercent !== undefined) body.progressPercent = input.progressPercent;
      if (input.classSessionId !== undefined) body.classSessionId = input.classSessionId;
      const assignment = await updateUniversityAssignment(token, workspaceId, assignmentId, body);
      study.upsertAssignmentInState(assignment);
    },
    [token, workspaceId, study],
  );

  const deleteTask = useCallback(
    async (assignmentId: string) => {
      if (!token || !workspaceId) return;
      await deleteUniversityAssignment(token, workspaceId, assignmentId);
      study.removeAssignmentFromState(assignmentId);
    },
    [token, workspaceId, study],
  );

  const setStatus = useCallback(
    async (assignmentId: string, status: TaskStatus) => {
      await updateTask(assignmentId, { status });
    },
    [updateTask],
  );

  const setProgress = useCallback(
    async (assignmentId: string, progress: number) => {
      const clamped = Math.min(100, Math.max(0, progress));
      await updateTask(assignmentId, { progressPercent: clamped });
    },
    [updateTask],
  );

  const error = linkError ?? study.error;
  const loading = !ready || study.loading || ensuringWorkspace;

  const value: StudentTasksContextValue = {
    tasks,
    filteredTasks,
    courses: study.state.courses,
    workspaceId,
    loading,
    ensuringWorkspace,
    error,
    searchQuery,
    activeFilter,
    setSearchQuery,
    setActiveFilter,
    refresh,
    createTask,
    updateTask,
    deleteTask,
    setStatus,
    setProgress,
    getTasksForCourse,
    getTasksForSession,
    resolveServerCourseId,
  };

  return (
    <StudentTasksContext.Provider value={value}>{children}</StudentTasksContext.Provider>
  );
}

export function useStudentTasks(): StudentTasksContextValue {
  const ctx = useContext(StudentTasksContext);
  if (!ctx) {
    throw new Error("useStudentTasks must be used within StudentTasksProvider");
  }
  return ctx;
}

export function useStudentTasksOptional(): StudentTasksContextValue | null {
  return useContext(StudentTasksContext);
}
