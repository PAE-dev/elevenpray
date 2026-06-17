"use client";

import { cn } from "@/lib/utils";
import {
  normalizeStudentGradeScale,
  type StudentGradeScale,
} from "@/lib/student-grade-scale";
import {
  STUDENT_MODAL_INPUT,
  STUDENT_MODAL_LABEL,
} from "../../components/student-modal-classes";

const LETTER_GRADES = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D",
  "F",
] as const;

interface ApprovedGradeFieldProps {
  id: string;
  label: string;
  hint?: string;
  gradeScale?: StudentGradeScale | null;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ApprovedGradeField({
  id,
  label,
  hint,
  gradeScale: rawScale,
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
}: ApprovedGradeFieldProps) {
  const gradeScale = normalizeStudentGradeScale(rawScale ?? null);
  const inputClass = cn(STUDENT_MODAL_INPUT, "mt-1");

  return (
    <div className={className}>
      <label htmlFor={id} className={STUDENT_MODAL_LABEL}>
        {label}
      </label>
      {gradeScale === "A_F" ? (
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn(inputClass, "cursor-pointer")}
        >
          <option value="">—</option>
          {LETTER_GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={gradeScale === "0_100" ? 100 : 20}
          step={0.1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={inputClass}
          placeholder={gradeScale === "0_100" ? "0–100" : "0–20"}
        />
      )}
      {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}
