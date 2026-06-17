"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  STUDENT_MODAL_FIELD,
  STUDENT_MODAL_FORM,
  STUDENT_MODAL_INPUT,
  STUDENT_MODAL_LABEL,
} from "../../components/student-modal-classes";
import type { CurriculumCourse, CourseColorToken, CurriculumStatus } from "@/app/lib/curriculum/types";
import { CURRICULUM_COLOR_TOKENS } from "@/app/lib/curriculum/types";
import { cycleToRoman } from "@/app/lib/curriculum/curriculum-utils";
import type { StudentGradeScale } from "@/lib/student-grade-scale";
import { ApprovedGradeField } from "./ApprovedGradeField";

export interface MallaCourseFormValues {
  name: string;
  code: string;
  credits: number;
  cycleNumber: number;
  colorToken: CourseColorToken;
  prerequisiteIds: string[];
  status: CurriculumStatus;
  approvedGrade: string;
}

interface MallaCourseFormProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: CurriculumCourse | null;
  allCourses: CurriculumCourse[];
  defaultCycle?: number;
  maxCycle?: number;
  gradeScale?: StudentGradeScale | null;
  onClose: () => void;
  onSubmit: (values: MallaCourseFormValues) => Promise<void>;
}

export function MallaCourseForm({
  open,
  mode,
  initial,
  allCourses,
  defaultCycle = 1,
  maxCycle = 12,
  gradeScale,
  onClose,
  onSubmit,
}: MallaCourseFormProps) {
  const t = useTranslations("studentMalla");
  const uid = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState(3);
  const [cycleNumber, setCycleNumber] = useState(defaultCycle);
  const [colorToken, setColorToken] = useState<CourseColorToken>("violet");
  const [prerequisiteIds, setPrerequisiteIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CurriculumStatus>("pending");
  const [approvedGrade, setApprovedGrade] = useState("");
  const [prereqSearch, setPrereqSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const fieldIds = useMemo(
    () => ({
      name: `${uid}-name`,
      code: `${uid}-code`,
      credits: `${uid}-credits`,
      cycle: `${uid}-cycle`,
      status: `${uid}-status`,
      approvedGrade: `${uid}-approved-grade`,
      prereqSearch: `${uid}-prereq-search`,
    }),
    [uid],
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setCode(initial.code ?? "");
      setCredits(initial.credits);
      setCycleNumber(initial.cycleNumber);
      setColorToken(initial.colorToken);
      setPrerequisiteIds(initial.prerequisiteIds);
      setStatus(initial.status);
      setApprovedGrade(initial.approvedGrade ?? "");
    } else {
      setName("");
      setCode("");
      setCredits(3);
      setCycleNumber(defaultCycle);
      setColorToken("violet");
      setPrerequisiteIds([]);
      setStatus("pending");
      setApprovedGrade("");
    }
    setPrereqSearch("");
    const tFocus = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(tFocus);
  }, [open, initial, defaultCycle]);

  const eligiblePrereqs = useMemo(() => {
    const q = prereqSearch.trim().toLowerCase();
    return allCourses.filter((c) => {
      if (c.id === initial?.id) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.code?.toLowerCase().includes(q) ?? false)) {
        return false;
      }
      return true;
    });
  }, [allCourses, initial?.id, prereqSearch]);

  const groupedPrereqs = useMemo(() => {
    const map = new Map<number, CurriculumCourse[]>();
    for (const c of eligiblePrereqs) {
      if (!map.has(c.cycleNumber)) map.set(c.cycleNumber, []);
      map.get(c.cycleNumber)!.push(c);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [eligiblePrereqs]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim(),
        credits,
        cycleNumber,
        colorToken,
        prerequisiteIds,
        status,
        approvedGrade: status === "approved" ? approvedGrade.trim() : "",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const togglePrereq = (id: string) => {
    setPrerequisiteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const preventFormFocusSteal = (e: React.MouseEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "FORM") {
      e.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("cancel")}
      />
      <form
        onSubmit={handleSubmit}
        onMouseDown={preventFormFocusSteal}
        className={cn(
          STUDENT_MODAL_FORM,
          "relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {mode === "create" ? t("addCourse") : t("edit")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={STUDENT_MODAL_FIELD}>
          <label htmlFor={fieldIds.name} className={STUDENT_MODAL_LABEL}>
            {t("formName")}
          </label>
          <input
            ref={nameInputRef}
            id={fieldIds.name}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(STUDENT_MODAL_INPUT, "mt-1")}
            required
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={STUDENT_MODAL_FIELD}>
            <label htmlFor={fieldIds.code} className={STUDENT_MODAL_LABEL}>
              {t("formCode")}
            </label>
            <input
              id={fieldIds.code}
              type="text"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={cn(STUDENT_MODAL_INPUT, "mt-1")}
            />
          </div>
          <div className={STUDENT_MODAL_FIELD}>
            <label htmlFor={fieldIds.credits} className={STUDENT_MODAL_LABEL}>
              {t("formCredits")}
            </label>
            <input
              id={fieldIds.credits}
              type="number"
              inputMode="decimal"
              min={0}
              max={99}
              step={0.5}
              value={credits}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setCredits(0);
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n)) setCredits(n);
              }}
              className={cn(STUDENT_MODAL_INPUT, "mt-1")}
            />
          </div>
        </div>

        <div className={cn("mt-4", STUDENT_MODAL_FIELD)}>
          <label htmlFor={fieldIds.cycle} className={STUDENT_MODAL_LABEL}>
            {t("formCycle")}
          </label>
          <select
            id={fieldIds.cycle}
            value={cycleNumber}
            onChange={(e) => setCycleNumber(Number(e.target.value))}
            className={cn(STUDENT_MODAL_INPUT, "mt-1 cursor-pointer")}
          >
            {Array.from({ length: Math.max(1, maxCycle) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {t("cycleLabel", { roman: cycleToRoman(n) })}
              </option>
            ))}
          </select>
        </div>

        <div className={cn("mt-4", STUDENT_MODAL_FIELD)}>
          <label htmlFor={fieldIds.status} className={STUDENT_MODAL_LABEL}>
            {t("formStatus")}
          </label>
          <select
            id={fieldIds.status}
            value={status}
            onChange={(e) => {
              const next = e.target.value as CurriculumStatus;
              setStatus(next);
              if (next !== "approved") setApprovedGrade("");
            }}
            className={cn(STUDENT_MODAL_INPUT, "mt-1 cursor-pointer")}
          >
            <option value="pending">{t("status_pending")}</option>
            <option value="in_progress">{t("status_in_progress")}</option>
            <option value="approved">{t("status_approved")}</option>
            <option value="failed">{t("status_failed")}</option>
          </select>
        </div>

        {status === "approved" ? (
          <ApprovedGradeField
            id={fieldIds.approvedGrade}
            label={t("formApprovedGrade")}
            hint={t("formApprovedGradeHint")}
            gradeScale={gradeScale}
            value={approvedGrade}
            onChange={setApprovedGrade}
            className="mt-4"
          />
        ) : null}

        <div className="mt-4">
          <span className={STUDENT_MODAL_LABEL}>{t("formColor")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CURRICULUM_COLOR_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => setColorToken(token)}
                aria-label={token}
                className={cn(
                  "h-8 w-8 cursor-pointer rounded-full border-2 transition select-none",
                  token === "blue" && "bg-blue-500",
                  token === "violet" && "bg-violet-500",
                  token === "emerald" && "bg-emerald-500",
                  token === "amber" && "bg-amber-500",
                  token === "rose" && "bg-rose-500",
                  token === "cyan" && "bg-cyan-500",
                  token === "indigo" && "bg-indigo-500",
                  token === "teal" && "bg-teal-500",
                  colorToken === token ? "border-white ring-2 ring-[var(--accent)]" : "border-transparent",
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className={STUDENT_MODAL_LABEL}>
            {t("formPrereqs")} ({prerequisiteIds.length})
          </span>
          <div className="relative mt-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden
            />
            <input
              id={fieldIds.prereqSearch}
              type="search"
              autoComplete="off"
              value={prereqSearch}
              onChange={(e) => setPrereqSearch(e.target.value)}
              placeholder={t("searchPrereq")}
              className={cn(STUDENT_MODAL_INPUT, "py-2 pl-10 pr-3")}
            />
          </div>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
            {groupedPrereqs.length === 0 ? (
              <p className="px-2 py-3 text-xs text-[var(--text-muted)]">{t("noPrereqs")}</p>
            ) : (
              groupedPrereqs.map(([cycle, list]) => (
                <div key={cycle} className="mb-2">
                  <p className="px-2 text-[10px] font-medium uppercase text-[var(--text-muted)]">
                    {t("cycleShort", { roman: cycleToRoman(cycle) })}
                  </p>
                  {list.map((c) => {
                    const checkboxId = `${uid}-prereq-${c.id}`;
                    return (
                      <div
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--bg-elevated)]"
                      >
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={prerequisiteIds.includes(c.id)}
                          onChange={() => togglePrereq(c.id)}
                          className="cursor-pointer rounded"
                        />
                        <label
                          htmlFor={checkboxId}
                          className="flex-1 cursor-pointer select-none text-sm text-[var(--text-primary)]"
                        >
                          {c.code ? `${c.code} · ` : ""}
                          {c.name}
                        </label>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-primary)] select-none"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--accent-fg)] select-none disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}
