const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
};

/** Parsea expresiones coloquiales de fecha a ISO (America/Lima). */
export function parseColloquialDate(text: string, now = new Date()): string | null {
  const m = text.toLowerCase();

  if (/\bhoy\b/.test(m)) {
    return toLimaIso(now);
  }

  if (/\bma[nñ]ana\b/.test(m)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toLimaIso(d);
  }

  if (/\bpasado\s+ma[nñ]ana\b/.test(m)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return toLimaIso(d);
  }

  for (const [name, dayIndex] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b(el\\s+)?${name}\\b`, 'i');
    if (re.test(m)) {
      return toLimaIso(nextWeekday(now, dayIndex));
    }
  }

  const isoMatch = m.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const dmyMatch = m.match(/(\d{1,2})\s*(de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\s*(de\s+)?(\d{4})?/i);
  if (dmyMatch) {
    const months: Record<string, number> = {
      ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
      jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
    };
    const day = parseInt(dmyMatch[1], 10);
    const monthKey = dmyMatch[3].slice(0, 3).toLowerCase();
    const month = months[monthKey];
    const year = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : now.getFullYear();
    if (month !== undefined) {
      const d = new Date(year, month, day, 23, 59, 0);
      return toLimaIso(d);
    }
  }

  return null;
}

function nextWeekday(from: Date, targetDay: number): Date {
  const d = new Date(from);
  const current = d.getDay();
  let delta = targetDay - current;
  if (delta <= 0) delta += 7;
  d.setDate(d.getDate() + delta);
  d.setHours(23, 59, 0, 0);
  return d;
}

function toLimaIso(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const da = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${mo}-${da}`;
}

/** Fecha legible en español (Perú). */
export function formatDeadlineHuman(isoOrColloquial: string): string {
  const iso = parseColloquialDate(isoOrColloquial) ?? isoOrColloquial;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoOrColloquial;
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Lima',
  });
}
