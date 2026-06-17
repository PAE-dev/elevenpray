import { parseColloquialDate } from './date-parser';

const TITLE_STOPWORDS = new Set([
  'es', 'una', 'un', 'el', 'la', 'los', 'las', 'para', 'de', 'en', 'y', 'o',
  'tarea', 'tareas', 'entrega', 'nueva', 'crea', 'crear', 'guarda', 'agregar',
]);

const COMMAND_PHRASES =
  /crea(r)?\s+(una\s+)?tarea|nueva\s+tarea|agregar\s+tarea|guardar\s+tarea/i;

export function isValidTaskTitle(value: unknown): boolean {
  const title = String(value ?? '').trim();
  if (title.length < 4) return false;
  if (COMMAND_PHRASES.test(title)) return false;
  if (/^para\s+el\s+/i.test(title)) return false;
  if (/^(es|de|la|el|una)\s/i.test(title) && title.length < 12) return false;
  const words = title.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 1 && TITLE_STOPWORDS.has(words[0])) return false;
  if (words.every((w) => TITLE_STOPWORDS.has(w))) return false;
  return true;
}

const COURSE_STOPWORDS = new Set([
  'hola', 'hi', 'hey', 'si', 'sí', 'no', 'ok', 'dale', 'gracias', 'bueno', 'listo',
  'de', 'del', 'el', 'la', 'es', 'un', 'una',
]);

export function isValidCourseName(value: unknown): boolean {
  const name = String(value ?? '').trim();
  if (name.length < 2 || name.length > 40) return false;
  if (COURSE_STOPWORDS.has(name.toLowerCase())) return false;
  if (COMMAND_PHRASES.test(name)) return false;
  if (parseColloquialDate(name)) return false;
  if (/\b(tarea|crea|crear|domingo|lunes|martes|miércoles|jueves|viernes|sábado|mañana|hoy)\b/i.test(name)) {
    return false;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(name)) return false;
  if (name.split(/\s+/).length > 5) return false;
  return true;
}

export function isValidDeadline(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const iso = parseColloquialDate(raw) ?? raw;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return !Number.isNaN(d.getTime());
}

export function normalizeDeadline(value: unknown): string {
  const raw = String(value ?? '').trim();
  return parseColloquialDate(raw) ?? raw;
}

/** Elimina slots inválidos o corruptos (p. ej. de sesiones anteriores). */
export function sanitizeSlotsForTool(
  toolName: string,
  slots: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...slots };

  if (toolName === 'create_task') {
    if (out.title !== undefined && !isValidTaskTitle(out.title)) delete out.title;
    if (out.course_name !== undefined && !isValidCourseName(out.course_name)) {
      delete out.course_name;
    }
    if (out.deadline !== undefined) {
      if (!isValidDeadline(out.deadline)) delete out.deadline;
      else out.deadline = normalizeDeadline(out.deadline);
    }
  }

  if (toolName === 'edit_task') {
    if (out.task_title !== undefined && !isValidTaskTitle(out.task_title)) {
      delete out.task_title;
    }
    if (out.new_value !== undefined && String(out.new_value).trim().length < 2) {
      delete out.new_value;
    }
  }

  if (toolName === 'schedule_reminder') {
    if (out.title !== undefined && String(out.title).trim().length < 3) delete out.title;
    if (out.remind_at !== undefined) {
      if (!isValidDeadline(out.remind_at)) delete out.remind_at;
      else out.remind_at = normalizeDeadline(out.remind_at);
    }
  }

  return out;
}

export function hasValidCreateTaskSlots(slots: Record<string, unknown>): boolean {
  return (
    isValidTaskTitle(slots.title) &&
    isValidCourseName(slots.course_name) &&
    isValidDeadline(slots.deadline)
  );
}
