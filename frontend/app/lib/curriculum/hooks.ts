"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import {
  createCurriculumCourse,
  deleteCurriculumCourse,
  fetchCurriculum,
  importCurriculum,
  reorderCurriculumCourses,
  setCurriculumCourseStatus,
  updateCurriculumCourse,
} from "./api";
import type {
  CreateCurriculumCourseInput,
  CurriculumCourse,
  CurriculumState,
  CurriculumStatus,
  UpdateCurriculumCourseInput,
} from "./types";
import {
  buildUnlocksMap,
  computeCurriculumStats,
  computeUnlockState,
  type PrerequisiteEdge,
} from "./curriculum-utils";

function applyStatusPatch(
  courses: CurriculumCourse[],
  courseId: string,
  status: CurriculumStatus,
  approvedGrade?: string | null,
): CurriculumCourse[] {
  return courses.map((c) =>
    c.id === courseId
      ? {
          ...c,
          status,
          approvedAt: status === "approved" ? new Date().toISOString() : null,
          approvedGrade:
            status === "approved"
              ? approvedGrade !== undefined
                ? approvedGrade
                : c.approvedGrade
              : null,
          failedAt: status === "failed" ? new Date().toISOString() : null,
        }
      : c,
  );
}

function enrichCourses(courses: CurriculumCourse[]): CurriculumCourse[] {
  const edges: PrerequisiteEdge[] = courses.flatMap((c) =>
    c.prerequisiteIds.map((prerequisiteId) => ({
      courseId: c.id,
      prerequisiteId,
    })),
  );
  const unlocksMap = buildUnlocksMap(edges);
  const statusById = new Map(courses.map((c) => [c.id, c.status]));
  return courses.map((c) => ({
    ...c,
    unlocksIds: unlocksMap.get(c.id) ?? [],
    isUnlocked: computeUnlockState(c.id, c.status, c.prerequisiteIds, statusById),
  }));
}

function buildStateFromCourses(
  prev: CurriculumState,
  courses: CurriculumCourse[],
): CurriculumState {
  const enriched = enrichCourses(courses);
  const prerequisites = enriched.flatMap((c) =>
    c.prerequisiteIds.map((prerequisiteId) => ({
      courseId: c.id,
      prerequisiteId,
    })),
  );
  return {
    courses: enriched,
    prerequisites,
    stats: computeCurriculumStats(enriched),
    totalCycles: prev.totalCycles,
    cycleNumbers: prev.cycleNumbers,
  };
}

export function useCurriculum() {
  const { token } = useAuth();
  const [state, setState] = useState<CurriculumState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<CurriculumState | null>(null);
  stateRef.current = state;

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) {
      setState(null);
      setLoading(false);
      return;
    }
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchCurriculum(token);
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading curriculum");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const createCourse = useCallback(
    async (input: CreateCurriculumCourseInput) => {
      if (!token) return;
      const prev = stateRef.current;
      if (prev) {
        const optimistic: CurriculumCourse = {
          id: `temp-${Date.now()}`,
          userId: "",
          workspaceId: input.workspaceId ?? null,
          name: input.name,
          code: input.code ?? null,
          credits: input.credits ?? 0,
          cycleNumber: input.cycleNumber,
          status: input.status ?? "pending",
          colorToken: input.colorToken ?? "violet",
          notes: null,
          approvedAt: input.status === "approved" ? new Date().toISOString() : null,
          approvedGrade: input.approvedGrade ?? null,
          failedAt: input.status === "failed" ? new Date().toISOString() : null,
          sortOrder: prev.courses.filter((c) => c.cycleNumber === input.cycleNumber).length,
          prerequisiteIds: input.prerequisiteIds ?? [],
          unlocksIds: [],
          isUnlocked: true,
          linkedCourseId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setState(buildStateFromCourses(prev, [...prev.courses, optimistic]));
      }
      try {
        const data = await createCurriculumCourse(token, input);
        setState(data);
        return data;
      } catch (e) {
        if (prev) setState(prev);
        throw e;
      }
    },
    [token],
  );

  const updateCourse = useCallback(
    async (courseId: string, input: UpdateCurriculumCourseInput) => {
      if (!token) return;
      const prev = stateRef.current;
      if (prev) {
        const patched = prev.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                ...(input.name != null ? { name: input.name } : {}),
                ...(input.code !== undefined ? { code: input.code || null } : {}),
                ...(input.credits !== undefined ? { credits: input.credits } : {}),
                ...(input.cycleNumber != null ? { cycleNumber: input.cycleNumber } : {}),
                ...(input.colorToken != null ? { colorToken: input.colorToken } : {}),
                ...(input.status != null ? { status: input.status } : {}),
                ...(input.approvedGrade !== undefined
                  ? { approvedGrade: input.approvedGrade || null }
                  : {}),
                ...(input.prerequisiteIds !== undefined
                  ? { prerequisiteIds: input.prerequisiteIds }
                  : {}),
              }
            : c,
        );
        setState(buildStateFromCourses(prev, patched));
      }
      try {
        const data = await updateCurriculumCourse(token, courseId, input);
        setState(data);
        return data;
      } catch (e) {
        if (prev) setState(prev);
        throw e;
      }
    },
    [token],
  );

  const setStatus = useCallback(
    async (
      courseId: string,
      status: CurriculumStatus,
      options?: { force?: boolean; approvedGrade?: string },
    ) => {
      if (!token) return;
      const prev = stateRef.current;
      if (!prev) return;

      const previousStatus = prev.courses.find((c) => c.id === courseId)?.status;
      const previousGrade = prev.courses.find((c) => c.id === courseId)?.approvedGrade;
      setState(
        buildStateFromCourses(
          prev,
          applyStatusPatch(
            prev.courses,
            courseId,
            status,
            options?.approvedGrade ?? (status === "approved" ? previousGrade : null),
          ),
        ),
      );

      try {
        const data = await setCurriculumCourseStatus(token, courseId, status, options);
        setState(data);
        return { data, previousStatus };
      } catch (e) {
        if (previousStatus) {
          setState(
            buildStateFromCourses(
              prev,
              applyStatusPatch(prev.courses, courseId, previousStatus, previousGrade),
            ),
          );
        }
        throw e;
      }
    },
    [token],
  );

  const removeCourse = useCallback(
    async (courseId: string) => {
      if (!token) return;
      const prev = stateRef.current;
      if (prev) {
        setState(
          buildStateFromCourses(
            prev,
            prev.courses.filter((c) => c.id !== courseId),
          ),
        );
      }
      try {
        const data = await deleteCurriculumCourse(token, courseId);
        setState(data);
        return data;
      } catch (e) {
        if (prev) setState(prev);
        throw e;
      }
    },
    [token],
  );

  const reorder = useCallback(
    async (cycleNumber: number, orderedIds: string[]) => {
      if (!token) return;
      const data = await reorderCurriculumCourses(token, cycleNumber, orderedIds);
      setState(data);
      return data;
    },
    [token],
  );

  const importTemplate = useCallback(
    async (
      items: Parameters<typeof importCurriculum>[1],
      workspaceId?: string,
    ) => {
      if (!token) return;
      const data = await importCurriculum(token, items, workspaceId);
      setState(data);
      return data;
    },
    [token],
  );

  const coursesByCycle = useMemo(() => {
    if (!state) return new Map<number, CurriculumCourse[]>();
    const map = new Map<number, CurriculumCourse[]>();
    for (const c of state.courses) {
      if (!map.has(c.cycleNumber)) map.set(c.cycleNumber, []);
      map.get(c.cycleNumber)!.push(c);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [state]);

  const cycleNumbers = useMemo(() => {
    if (state?.cycleNumbers && state.cycleNumbers.length > 0) {
      return state.cycleNumbers;
    }
    const nums = [...coursesByCycle.keys()].sort((a, b) => a - b);
    return nums.length > 0 ? nums : [1];
  }, [coursesByCycle, state?.cycleNumbers]);

  const totalCycles = state?.totalCycles ?? cycleNumbers.length;

  const getCourseById = useCallback(
    (id: string) => state?.courses.find((c) => c.id === id) ?? null,
    [state],
  );

  return {
    state,
    loading,
    error,
    load,
    createCourse,
    updateCourse,
    setStatus,
    removeCourse,
    reorder,
    importTemplate,
    coursesByCycle,
    cycleNumbers,
    totalCycles,
    getCourseById,
    token,
  };
}
