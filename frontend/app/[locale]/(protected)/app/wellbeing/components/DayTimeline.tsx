"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BookOpen, Play, Smile, Sparkles, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { DayEntryDto, DayEntryType } from "@/app/lib/day-entries-api";

const ENTRY_ICONS: Record<DayEntryType, LucideIcon> = {
  checkin: Smile,
  breathing: Wind,
  pomodoro: Play,
  journal: BookOpen,
  sos: Sparkles,
};

function formatTime(iso: string): string {
  return format(new Date(iso), "HH:mm", { locale: es });
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function dedupeCheckinEntries(entries: DayEntryDto[]): DayEntryDto[] {
  const checkins = entries.filter((e) => e.entryType === "checkin");
  if (checkins.length <= 1) return entries;

  const latest = checkins[checkins.length - 1];
  let kept = false;
  return entries.filter((e) => {
    if (e.entryType !== "checkin") return true;
    if (!kept) {
      kept = true;
      return e.id === latest.id;
    }
    return false;
  });
}

export function DayTimeline({ entries, title }: { entries: DayEntryDto[]; title?: string }) {
  const t = useTranslations("studentWellbeing");
  const visibleEntries = useMemo(() => dedupeCheckinEntries(entries), [entries]);

  function getDescription(entry: DayEntryDto): string {
    if (entry.entryType === "checkin") {
      const mood = asString(entry.payload.mood) ?? "normal";
      return t("timeline.labels.checkin", { mood: t(`moods.${mood}`) });
    }
    if (entry.entryType === "breathing") {
      const min = asNumber(entry.payload.durationMinutes) ?? 2;
      return t("timeline.labels.breathing", { min });
    }
    if (entry.entryType === "pomodoro") {
      const min = asNumber(entry.payload.durationMinutes) ?? 25;
      return t("timeline.labels.pomodoro", { min });
    }
    if (entry.entryType === "journal") {
      const prompt = asString(entry.payload.prompt) ?? "";
      return t("timeline.labels.journal", { prompt });
    }
    const min = asNumber(entry.payload.durationMinutes) ?? 1;
    return t("timeline.labels.sos", { min });
  }

  return (
    <section className="wellbeing-calm-block">
      <h3 className="mb-4 text-lg font-semibold text-[var(--app-fg)]">
        {title ?? t("timeline.title")}
      </h3>
      {visibleEntries.length === 0 ? (
        <p className="py-2 text-sm text-[var(--app-fg-muted)]">{t("timeline.empty")}</p>
      ) : (
        <div className="space-y-4">
          {visibleEntries.map((entry, index) => {
            const Icon = ENTRY_ICONS[entry.entryType];
            const content = asString(entry.payload.content);
            return (
              <article
                key={entry.id}
                className="day-timeline-item relative pl-10"
                style={{ "--item-delay": `${index * 60}ms` } as React.CSSProperties}
              >
                <span className="absolute left-[15px] top-8 h-full w-px bg-[var(--app-border)]/70 last:hidden" />
                <span className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="rounded-xl border border-[var(--app-border)]/70 bg-[var(--app-surface)] p-3">
                  <p className="text-xs font-medium text-[var(--app-fg-muted)]">
                    {formatTime(entry.occurredAt)}
                  </p>
                  <p className="text-sm text-[var(--app-fg-secondary)]">{getDescription(entry)}</p>
                  {entry.entryType === "checkin" ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(Array.isArray(entry.payload.factors) ? entry.payload.factors : []).map((f) => (
                        <span
                          key={String(f)}
                          className="rounded-full bg-[var(--app-primary)]/10 px-2 py-0.5 text-[10px] text-[var(--app-primary)]"
                        >
                          {t(`factors.${String(f)}`)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {entry.entryType === "journal" && content ? (
                    <p className="mt-2 line-clamp-3 text-xs text-[var(--app-fg-muted)]">{content}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
