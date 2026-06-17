import { describe, expect, it } from "vitest";
import {
  countCoursesByCycle,
  defaultCycleFilterForCurriculum,
  filterCurriculumCoursesForList,
  findCurriculumCourseByListId,
  resolveActiveCycleNumber,
  resolveDefaultCycleForNewCourse,
} from "./courses-list";
import type { CurriculumCourse } from "./types";

function course(
  overrides: Partial<CurriculumCourse> & Pick<CurriculumCourse, "id" | "cycleNumber" | "status">,
): CurriculumCourse {
  return {
    userId: "u1",
    workspaceId: null,
    name: "Test",
    code: null,
    credits: 3,
    colorToken: "violet",
    notes: null,
    approvedAt: null,
    approvedGrade: null,
    failedAt: null,
    sortOrder: 0,
    prerequisiteIds: [],
    unlocksIds: [],
    isUnlocked: true,
    linkedCourseId: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const sampleCourses = [
  course({ id: "a", cycleNumber: 1, status: "pending", sortOrder: 0 }),
  course({ id: "b", cycleNumber: 1, status: "in_progress", sortOrder: 1 }),
  course({ id: "c", cycleNumber: 1, status: "approved", sortOrder: 2 }),
  course({ id: "d", cycleNumber: 2, status: "approved" }),
  course({ id: "e", cycleNumber: 2, status: "failed" }),
];

describe("filterCurriculumCoursesForList", () => {
  it("shows all courses in the active cycle for current filter", () => {
    expect(
      filterCurriculumCoursesForList(sampleCourses, "current", { activeCycle: 1 }).map(
        (c) => c.id,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("shows all courses for all filter", () => {
    expect(filterCurriculumCoursesForList(sampleCourses, "all")).toHaveLength(5);
  });

  it("shows every course in a chosen cycle", () => {
    expect(filterCurriculumCoursesForList(sampleCourses, 2).map((c) => c.id)).toEqual(["d", "e"]);
  });
});

describe("resolveActiveCycleNumber", () => {
  it("uses profile cycle when courses exist in that cycle", () => {
    expect(resolveActiveCycleNumber(sampleCourses, 1)).toBe(1);
  });

  it("ignores profile cycle when malla has no courses there", () => {
    expect(resolveActiveCycleNumber(sampleCourses, 8)).toBe(1);
  });

  it("infers cycle with most activity when no profile", () => {
    expect(resolveActiveCycleNumber(sampleCourses)).toBe(1);
  });
});

describe("resolveDefaultCycleForNewCourse", () => {
  it("defaults to 1 when malla is empty even if profile says 12", () => {
    expect(resolveDefaultCycleForNewCourse([], 12)).toBe(1);
  });

  it("uses active cycle when malla already has courses", () => {
    expect(resolveDefaultCycleForNewCourse(sampleCourses, 12)).toBe(1);
  });
});

describe("countCoursesByCycle", () => {
  it("counts per cycle", () => {
    const map = countCoursesByCycle(sampleCourses);
    expect(map.get(1)).toBe(3);
    expect(map.get(2)).toBe(2);
  });
});

describe("findCurriculumCourseByListId", () => {
  it("matches by curriculum id or linked study course id", () => {
    const courses = [
      course({ id: "cur-1", cycleNumber: 1, status: "in_progress", linkedCourseId: "study-9" }),
    ];
    expect(findCurriculumCourseByListId(courses, "cur-1")?.id).toBe("cur-1");
    expect(findCurriculumCourseByListId(courses, "study-9")?.id).toBe("cur-1");
  });
});

describe("defaultCycleFilterForCurriculum", () => {
  it("defaults to current when malla has courses", () => {
    expect(defaultCycleFilterForCurriculum(sampleCourses)).toBe("current");
  });

  it("defaults to current when malla is empty", () => {
    expect(defaultCycleFilterForCurriculum([])).toBe("current");
  });
});
