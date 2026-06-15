"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Meh, Moon, Frown, Smile, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MoodId } from "../wellbeing-types";
import { useWellbeingCheckInContext } from "./WellbeingCheckInContext";
import { useWellbeingDayContext } from "./WellbeingDayProvider";
import { getGreetingKey } from "../lib/get-greeting";
import { isNightTime } from "../lib/get-greeting";
import { useAuth } from "@/app/providers/auth-provider";

const MOOD_ICONS: Record<MoodId, LucideIcon> = {
  excellent: Zap,
  good: Smile,
  normal: Meh,
  low: Frown,
  bad: Moon,
};

export function TodayCheckInSummary({ index = 0 }: { index?: number }) {
  const t = useTranslations("studentWellbeing");
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "estudiante";
  const { startEditing, selectedMood, factors, note } = useWellbeingCheckInContext();
  const { entries } = useWellbeingDayContext();

  if (!selectedMood) return null;

  const latestCheckin = [...entries].reverse().find((entry) => entry.entryType === "checkin");
  const loggedAt = latestCheckin
    ? format(new Date(latestCheckin.occurredAt), "HH:mm", { locale: es })
    : null;

  const MoodIcon = MOOD_ICONS[selectedMood];
  const delayStyle = { "--wellbeing-delay": `${index * 80}ms` } as React.CSSProperties;

  return (
    <section className="wellbeing-calm-block" style={delayStyle}>
      <div className="rounded-3xl border border-[var(--app-border)]/70 bg-[var(--app-surface)] p-6 shadow-sm sm:p-8">
        <p className="text-base font-medium text-[var(--app-fg)]">
          {t(getGreetingKey(), { name: firstName })}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-primary)]/12 text-[var(--app-primary)]">
              <MoodIcon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm text-[var(--app-fg-secondary)]">
                {t("todaySummary.feeling")}{" "}
                <span className="font-semibold text-[var(--app-fg)]">{t(`moods.${selectedMood}`)}</span>
              </p>
              {loggedAt ? (
                <p className="text-xs text-[var(--app-fg-muted)]">
                  {t("todaySummary.loggedAt", { time: loggedAt })}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-fg-secondary)] transition hover:border-[var(--app-primary)]/40 hover:text-[var(--app-primary)]"
          >
            {t("todaySummary.edit")}
          </button>
        </div>

        {isNightTime() ? (
          <p className="mt-3 text-sm text-[var(--app-fg-secondary)]">{t("todaySummary.nightClosure")}</p>
        ) : null}

        {factors.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {factors.map((factor) => (
              <span
                key={factor}
                className="rounded-full bg-[var(--app-primary)]/10 px-2.5 py-1 text-[11px] text-[var(--app-primary)]"
              >
                {t(`factors.${factor}`)}
              </span>
            ))}
          </div>
        ) : null}
        {note.trim() ? <p className="mt-2 text-xs text-[var(--app-fg-muted)]">{note}</p> : null}
      </div>
    </section>
  );
}
