/**
 * Smoke checks for MallaGrid grouping logic (no test runner required).
 * Run: npx tsx app/[locale]/(protected)/app/malla/components/malla-grid.smoke.ts
 */
import type { CurriculumCourse } from "@/app/lib/curriculum/types";

function groupByCycle(courses: CurriculumCourse[]): Map<number, CurriculumCourse[]> {
  const map = new Map<number, CurriculumCourse[]>();
  for (const c of courses) {
    if (!map.has(c.cycleNumber)) map.set(c.cycleNumber, []);
    map.get(c.cycleNumber)!.push(c);
  }
  return map;
}

const sample: CurriculumCourse[] = [
  {
    id: "1",
    userId: "u",
    workspaceId: null,
    name: "Locked",
    code: "A",
    credits: 3,
    cycleNumber: 2,
    status: "pending",
    colorToken: "violet",
    notes: null,
    approvedAt: null,
    approvedGrade: null,
    failedAt: null,
    sortOrder: 0,
    prerequisiteIds: ["2"],
    unlocksIds: [],
    isUnlocked: false,
    linkedCourseId: null,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "2",
    userId: "u",
    workspaceId: null,
    name: "Prereq",
    code: "B",
    credits: 3,
    cycleNumber: 1,
    status: "approved",
    colorToken: "emerald",
    notes: null,
    approvedAt: null,
    approvedGrade: null,
    failedAt: null,
    sortOrder: 0,
    prerequisiteIds: [],
    unlocksIds: ["1"],
    isUnlocked: true,
    linkedCourseId: null,
    createdAt: "",
    updatedAt: "",
  },
];

const grouped = groupByCycle(sample);
if (grouped.size !== 2) throw new Error("expected 2 cycles");
if ((grouped.get(2)?.[0]?.isUnlocked) !== false) throw new Error("expected locked course");
console.log("MallaGrid smoke OK");
