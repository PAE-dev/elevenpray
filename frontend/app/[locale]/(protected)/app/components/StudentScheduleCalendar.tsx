"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  type ScheduleEventKind,
} from "../lib/mock-student-data";
import type { CalendarEvent } from "../lib/calendar-event-types";
import {
  buildHourMarks,
  buildSlotMarks,
  computeEventGeometry,
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  formatHourLabel,
  gridHeight,
  layoutDayEvents,
  minutesToTime,
  SLOT_MINUTES,
} from "../lib/schedule-grid-utils";

const PIXELS_PER_MINUTE = 2;
const GRID_HEIGHT = gridHeight(PIXELS_PER_MINUTE);
const TIME_AXIS_WIDTH = 52;
const GAP_PX = 4;

const KIND_TAG: Record<ScheduleEventKind, string> = {
  class: "bg-[var(--course-1-bg)] text-[var(--course-1-fg)]",
  task: "bg-[var(--accent-subtle)] text-[var(--accent)]",
  extra: "bg-[var(--course-2-bg)] text-[var(--course-2-fg)]",
  exam: "bg-[color-mix(in_srgb,var(--error)_14%,transparent)] text-[var(--error)]",
};

const KIND_BG: Record<ScheduleEventKind, string> = {
  class: "var(--schedule-class-bg)",
  task: "var(--schedule-task-bg)",
  extra: "var(--schedule-extra-bg)",
  exam: "var(--schedule-exam-bg)",
};

const KIND_BORDER: Record<ScheduleEventKind, string> = {
  class: "var(--schedule-class-border)",
  task: "var(--schedule-task-border)",
  extra: "var(--schedule-extra-border)",
  exam: "var(--schedule-exam-border)",
};

const KIND_STRONG: Record<ScheduleEventKind, string> = {
  class: "var(--schedule-class-strong)",
  task: "var(--schedule-task-strong)",
  extra: "var(--schedule-extra-strong)",
  exam: "var(--schedule-exam-strong)",
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface StudentScheduleCalendarProps {
  weekStart: Date;
  events: CalendarEvent[];
  onSlotClick: (dateKey: string, startTime: string) => void;
  onEventClick: (eventId: string) => void;
}

export function StudentScheduleCalendar({
  weekStart,
  events,
  onSlotClick,
  onEventClick,
}: StudentScheduleCalendarProps) {
  const t = useTranslations("studentCalendar");
  const locale = useLocale() as "es" | "en";
  const dateFnsLocale = locale === "en" ? enUS : es;

  const today = useMemo(() => new Date(), []);
  const todayKey = ymd(today);

  const [selectedDate, setSelectedDate] = useState(todayKey);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, key: ymd(date) };
      }),
    [weekStart],
  );

  useEffect(() => {
    if (!weekDays.some((d) => d.key === selectedDate)) {
      const todayInWeek = weekDays.find((d) => d.key === todayKey);
      setSelectedDate(todayInWeek?.key ?? weekDays[0]?.key ?? selectedDate);
    }
  }, [weekDays, selectedDate, todayKey]);

  const selectedDayEvents = useMemo(
    () => events.filter((e) => e.date === selectedDate),
    [events, selectedDate],
  );

  const laidOut = useMemo(
    () => layoutDayEvents(selectedDayEvents),
    [selectedDayEvents],
  );

  const isSelectedToday = selectedDate === todayKey;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const showNowLine =
    isSelectedToday && nowMinutes >= DAY_START_MINUTES && nowMinutes <= DAY_END_MINUTES;

  const hourMarks = useMemo(() => buildHourMarks(), []);
  const slotMarks = useMemo(() => buildSlotMarks(), []);

  return (
    <div className="schedule-calendar mx-auto w-full max-w-lg">
      {/* Week strip */}
      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {weekDays.map(({ date, key }) => {
          const selected = key === selectedDate;
          const isToday = isSameDay(date, today);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              className={cn(
                "flex flex-col items-center rounded-2xl border py-2.5 transition",
                selected
                  ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-[var(--app-bg)] shadow-sm"
                  : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)] hover:border-[var(--app-primary)]/30",
                !selected && isToday && "ring-1 ring-[var(--app-primary)]/40",
              )}
            >
              <span className="text-[10px] font-medium uppercase opacity-80">
                {format(date, "EEE", { locale: dateFnsLocale })}
              </span>
              <span className="mt-0.5 text-base font-semibold">{format(date, "d")}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="student-card overflow-hidden p-3">
        <div className="relative flex" style={{ minHeight: GRID_HEIGHT }}>
          {/* Time axis */}
          <div
            className="relative shrink-0 text-[10px] text-[var(--app-fg-muted)]"
            style={{ width: TIME_AXIS_WIDTH }}
          >
            {hourMarks.map((min) => (
              <div
                key={min}
                className="absolute right-2 -translate-y-full whitespace-nowrap"
                style={{ top: (min - DAY_START_MINUTES) * PIXELS_PER_MINUTE }}
              >
                {formatHourLabel(min, locale)}
              </div>
            ))}
          </div>

          {/* Grid + events */}
          <div
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{ height: GRID_HEIGHT }}
          >
            {hourMarks.map((min) => (
              <div
                key={min}
                className="pointer-events-none absolute left-0 right-0 border-t border-[var(--app-border)]/60"
                style={{ top: (min - DAY_START_MINUTES) * PIXELS_PER_MINUTE }}
              />
            ))}

            {slotMarks.map((min) => (
              <button
                type="button"
                key={min}
                onClick={() => onSlotClick(selectedDate, minutesToTime(min))}
                className="schedule-grid-cell absolute left-0 right-0"
                style={{
                  top: (min - DAY_START_MINUTES) * PIXELS_PER_MINUTE,
                  height: SLOT_MINUTES * PIXELS_PER_MINUTE,
                }}
                aria-label={`${minutesToTime(min)}`}
              />
            ))}

            {showNowLine && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                style={{
                  top: (nowMinutes - DAY_START_MINUTES) * PIXELS_PER_MINUTE,
                }}
              >
                <div className="-ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--app-primary)]" />
                <div className="h-0.5 flex-1 bg-[var(--app-primary)]" />
              </div>
            )}

            {laidOut.map((event) => {
              const { top, height } = computeEventGeometry(
                event.startMin,
                event.endMin,
                { pixelsPerMinute: PIXELS_PER_MINUTE, gapPx: GAP_PX, minHeight: 44 },
              );
              const widthPct = 100 / event.totalColumns;
              const leftPct = (event.column / event.totalColumns) * 100;

              return (
                <button
                  type="button"
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event.id);
                  }}
                  className="schedule-event-block z-10 text-[var(--app-fg)]"
                  style={{
                    position: "absolute",
                    top,
                    height,
                    left: `calc(${leftPct}% + ${GAP_PX / 2}px)`,
                    width: `calc(${widthPct}% - ${GAP_PX}px)`,
                    background: KIND_BG[event.kind],
                    borderColor: KIND_BORDER[event.kind],
                    // @ts-expect-error CSS variable
                    "--schedule-strong": KIND_STRONG[event.kind],
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="truncate pl-1 text-xs font-semibold">{event.title}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium",
                        KIND_TAG[event.kind],
                      )}
                    >
                      {t(`eventKind.${event.kind}`)}
                    </span>
                  </div>
                  {event.subtitle && (
                    <p className="mt-0.5 truncate pl-1 text-[10px] text-[var(--app-fg-secondary)]">
                      {event.subtitle}
                    </p>
                  )}
                </button>
              );
            })}

            {laidOut.length === 0 && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-[var(--app-fg-secondary)]">
                {t("emptyHint")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
