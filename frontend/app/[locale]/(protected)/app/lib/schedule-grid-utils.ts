import type { CalendarEvent } from "./calendar-event-types";

export const DAY_START_MINUTES = 7 * 60;
export const DAY_END_MINUTES = 24 * 60;
export const SLOT_MINUTES = 30;

export const TOTAL_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;

export function gridHeight(pixelsPerMinute: number): number {
  return TOTAL_MINUTES * pixelsPerMinute;
}

export function timeToMinutes(value: string): number {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function eventsOverlap(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number },
): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

type TimedEvent = CalendarEvent & { startMin: number; endMin: number };
export type LaidOutEvent = TimedEvent & { column: number; totalColumns: number };

export function layoutDayEvents(events: CalendarEvent[]): LaidOutEvent[] {
  const items: TimedEvent[] = events
    .map((e) => ({
      ...e,
      startMin: timeToMinutes(e.startTime),
      endMin: timeToMinutes(e.endTime),
    }))
    .filter((e) => e.endMin > e.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  if (items.length === 0) return [];

  const clusters: TimedEvent[][] = [];
  for (const ev of items) {
    let merged = false;
    for (const cluster of clusters) {
      if (cluster.some((c) => eventsOverlap(c, ev))) {
        cluster.push(ev);
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push([ev]);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const overlaps = clusters[i].some((a) =>
          clusters[j].some((b) => eventsOverlap(a, b)),
        );
        if (overlaps) {
          clusters[i] = [...clusters[i], ...clusters[j]];
          clusters.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  const result: LaidOutEvent[] = [];
  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const assigned: { ev: TimedEvent; col: number }[] = [];
    for (const ev of [...cluster].sort((a, b) => a.startMin - b.startMin)) {
      let col = columnEnds.findIndex((end) => end <= ev.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(ev.endMin);
      } else {
        columnEnds[col] = ev.endMin;
      }
      assigned.push({ ev, col });
    }
    const totalColumns = columnEnds.length;
    for (const { ev, col } of assigned) {
      result.push({ ...ev, column: col, totalColumns });
    }
  }
  return result;
}

export function buildHourMarks(): number[] {
  const marks: number[] = [];
  for (let m = DAY_START_MINUTES; m <= DAY_END_MINUTES; m += 60) marks.push(m);
  return marks;
}

export function buildSlotMarks(): number[] {
  const marks: number[] = [];
  for (let m = DAY_START_MINUTES; m < DAY_END_MINUTES; m += SLOT_MINUTES) marks.push(m);
  return marks;
}

export function computeEventGeometry(
  startMin: number,
  endMin: number,
  options: { pixelsPerMinute: number; gapPx: number; minHeight: number },
): { top: number; height: number } {
  const { pixelsPerMinute, gapPx, minHeight } = options;
  const maxHeight = gridHeight(pixelsPerMinute);

  const rawTop = (startMin - DAY_START_MINUTES) * pixelsPerMinute;
  const rawBottom = (endMin - DAY_START_MINUTES) * pixelsPerMinute;

  const top = Math.max(0, Math.min(rawTop, maxHeight));
  const clippedBottom = Math.min(rawBottom, maxHeight);
  const height = Math.max(minHeight, clippedBottom - top - gapPx);

  return { top, height };
}

export function formatHourLabel(minutes: number, locale: "es" | "en"): string {
  const h = Math.floor(minutes / 60);
  if (locale === "es") {
    return `${String(h).padStart(2, "0")}:00`;
  }
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display} ${suffix}`;
}
