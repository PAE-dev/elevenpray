"use client";

import { useMemo } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "../lib/calendar-event-types";
import { type ScheduleEventKind } from "../lib/mock-student-data";
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

const PIXELS_PER_MINUTE = 1.2;
const GRID_HEIGHT = gridHeight(PIXELS_PER_MINUTE);
const TIME_AXIS_WIDTH = 64;
const GAP_PX = 3;

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

interface WeeklyScheduleGridProps {
  weekStart: Date;
  events: CalendarEvent[];
  onSlotClick: (dateKey: string, startTime: string) => void;
  onEventClick: (eventId: string) => void;
}

export function WeeklyScheduleGrid({
  weekStart,
  events,
  onSlotClick,
  onEventClick,
}: WeeklyScheduleGridProps) {
  const t = useTranslations("studentCalendar");
  const locale = useLocale() as "es" | "en";
  const dateFnsLocale = locale === "en" ? enUS : es;

  const today = useMemo(() => new Date(), []);
  const todayKey = ymd(today);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        return { date, key: ymd(date), isToday: isSameDay(date, today) };
      }),
    [weekStart, today],
  );

  const hourMarks = useMemo(() => buildHourMarks(), []);
  const slotMarks = useMemo(() => buildSlotMarks(), []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    const out = new Map<string, ReturnType<typeof layoutDayEvents>>();
    for (const [key, list] of map) out.set(key, layoutDayEvents(list));
    return out;
  }, [events]);

  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const showNowLine =
    nowMinutes >= DAY_START_MINUTES && nowMinutes <= DAY_END_MINUTES;

  const gridColumns = `${TIME_AXIS_WIDTH}px repeat(7, minmax(0, 1fr))`;

  return (
    <div className="schedule-week student-card flex flex-col overflow-hidden">
      <div className="relative overflow-auto [scrollbar-gutter:stable]">
        {/* Cabecera de días — dentro del scroll para alinear columnas */}
        <div
          className="grid sticky top-0 z-10 border-b border-[var(--app-border)] bg-[var(--app-surface-elevated)]"
          style={{ gridTemplateColumns: gridColumns }}
        >
          <div className="px-3 py-3 text-[10px] uppercase tracking-wider text-[var(--app-fg-muted)]" />
          {weekDays.map((d) => (
            <div
              key={d.key}
              className={cn(
                "flex flex-col items-start gap-0.5 border-l border-[var(--app-border)] px-3 py-3",
                d.isToday && "bg-[var(--app-primary)]/5",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  d.isToday ? "text-[var(--app-primary)]" : "text-[var(--app-fg-muted)]",
                )}
              >
                {format(d.date, "EEE", { locale: dateFnsLocale })}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xl font-semibold",
                    d.isToday ? "text-[var(--app-primary)]" : "text-[var(--app-fg)]",
                  )}
                >
                  {format(d.date, "d")}
                </span>
                {d.isToday && (
                  <span className="rounded-full bg-[var(--app-primary)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--app-primary)]">
                    {t("today")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cuerpo de grid */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: gridColumns,
            minHeight: GRID_HEIGHT,
          }}
        >
          {/* Líneas maestras que cruzan de lado a lado */}
          {hourMarks.map((min) => (
            <div
              key={`master-line-${min}`}
              className="pointer-events-none absolute right-0 z-0 border-t border-[var(--app-border)]/60"
              style={{
                left: TIME_AXIS_WIDTH,
                top: (min - DAY_START_MINUTES) * PIXELS_PER_MINUTE,
              }}
            />
          ))}

          {/* Eje de tiempo */}
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {hourMarks.map((min) => (
              <div
                key={min}
                className="absolute right-2 -translate-y-full text-[10px] font-medium text-[var(--app-fg-muted)]"
                style={{ top: (min - DAY_START_MINUTES) * PIXELS_PER_MINUTE }}
              >
                {formatHourLabel(min, locale)}
              </div>
            ))}
          </div>

          {/* Columnas por día */}
          {weekDays.map((d) => {
            const dayLaid = eventsByDay.get(d.key) ?? [];
            return (
              <div
                key={d.key}
                className={cn(
                  "relative overflow-hidden border-l border-[var(--app-border)]",
                  d.isToday && "bg-[var(--app-primary)]/[0.03]",
                )}
                style={{ height: GRID_HEIGHT }}
              >
                {/* Slots clickeables */}
                {slotMarks.map((min) => (
                  <button
                    type="button"
                    key={min}
                    onClick={() => onSlotClick(d.key, minutesToTime(min))}
                    className="schedule-grid-cell absolute left-0 right-0"
                    style={{
                      top: (min - DAY_START_MINUTES) * PIXELS_PER_MINUTE,
                      height: SLOT_MINUTES * PIXELS_PER_MINUTE,
                    }}
                    aria-label={`${format(d.date, "EEE d", { locale: dateFnsLocale })} ${minutesToTime(min)}`}
                  />
                ))}

                {/* Línea ahora */}
                {d.isToday && showNowLine && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                    style={{
                      top: (nowMinutes - DAY_START_MINUTES) * PIXELS_PER_MINUTE,
                    }}
                  >
                    <div className="-ml-1.5 h-3 w-3 shrink-0 rounded-full bg-[var(--app-primary)] shadow-[0_0_0_3px_rgba(110,181,168,0.25)]" />
                    <div className="h-0.5 flex-1 bg-[var(--app-primary)]" />
                  </div>
                )}

                {/* Eventos */}
                {dayLaid.map((event) => {
                  const { top, height } = computeEventGeometry(
                    event.startMin,
                    event.endMin,
                    { pixelsPerMinute: PIXELS_PER_MINUTE, gapPx: GAP_PX, minHeight: 28 },
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
                        <p className="truncate pl-1 text-[11px] font-semibold leading-tight">
                          {event.title}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1 py-0.5 text-[9px] font-medium",
                            KIND_TAG[event.kind],
                          )}
                        >
                          {t(`eventKind.${event.kind}`)}
                        </span>
                      </div>
                      {event.subtitle && height > 36 && (
                        <p className="mt-0.5 truncate pl-1 text-[10px] text-[var(--app-fg-secondary)]">
                          {event.subtitle}
                        </p>
                      )}
                      {height > 52 && (
                        <p className="mt-0.5 pl-1 text-[10px] tabular-nums text-[var(--app-fg-muted)]">
                          {event.startTime.slice(0, 5)} – {event.endTime.slice(0, 5)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hint vacío */}
      {events.length === 0 && (
        <div className="border-t border-[var(--app-border)] bg-[var(--app-surface-soft)] px-4 py-2 text-center text-xs text-[var(--app-fg-secondary)]">
          {t("emptyHint")}
        </div>
      )}
    </div>
  );
}
