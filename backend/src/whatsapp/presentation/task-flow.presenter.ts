import { Injectable } from '@nestjs/common';
import { formatDeadlineHuman } from '../slots/date-parser';
import type { WhatsAppStudentSnapshot } from '../whatsapp-student-data.service';

export type TaskSlotName = 'title' | 'course_name' | 'deadline' | 'task_title' | 'field' | 'new_value';

@Injectable()
export class TaskFlowPresenter {
  presentCreateIntro(
    slots: Record<string, unknown>,
    options?: { showDeadline?: boolean },
  ): string {
    const parts: string[] = ['¡Vamos a crear tu tarea en Mitsyy! 📝'];
    if (options?.showDeadline && slots.deadline) {
      parts.push(`Fecha límite: ${formatDeadlineHuman(String(slots.deadline))}.`);
    }
    return parts.join('\n');
  }

  presentSlotQuestion(
    slot: TaskSlotName,
    slots: Record<string, unknown>,
    snapshot?: WhatsAppStudentSnapshot,
    options?: { deadlineMentionedNow?: boolean },
  ): string {
    const showDeadline =
      slot !== 'title' || Boolean(options?.deadlineMentionedNow);
    const intro = this.presentCreateIntro(slots, { showDeadline });
    const prefix = `${intro}\n\n`;

    switch (slot) {
      case 'title':
        return `${prefix}¿De qué trata la tarea? Escríbeme el nombre (ej. *Examen parcial*, *Entregar informe*).`;

      case 'course_name': {
        const courses = snapshot?.courses ?? [];
        if (courses.length === 0) {
          return `${prefix}¿Para qué curso es? Escribe el nombre o código de la materia.`;
        }
        const list = courses
          .slice(0, 8)
          .map((c, i) => `${i + 1}. ${c.name}${c.code ? ` (${c.code})` : ''}`)
          .join('\n');
        return `${prefix}¿Para qué curso es la tarea?\n\nTus materias:\n${list}\n\nResponde con el nombre o el número.`;
      }

      case 'deadline':
        return `${prefix}¿Para qué fecha es la entrega? (ej. *domingo*, *20 jun*, *2026-06-20*)`;

      case 'task_title': {
        const tasks = snapshot?.tasks ?? [];
        if (tasks.length === 0) {
          return 'No tienes tareas pendientes para editar.';
        }
        const list = tasks
          .slice(0, 8)
          .map((t, i) => `${i + 1}. ${t.title} — ${t.course}`)
          .join('\n');
        return `¿Cuál tarea quieres editar?\n\n${list}\n\nResponde con el nombre o el número.`;
      }

      case 'field':
        return `¿Qué quieres cambiar?\n1. Título\n2. Fecha límite\n3. Curso\n\nResponde con el número o la palabra.`;

      case 'new_value':
        if (slots.field === 'deadline') {
          return '¿Cuál es la nueva fecha? (ej. *viernes*, *25 jun*)';
        }
        if (slots.field === 'course_name') {
          return '¿A qué curso la movemos? Escribe el nombre o código.';
        }
        return '¿Cuál es el nuevo título de la tarea?';

      default:
        return '¿Puedes darme más detalles?';
    }
  }

  presentCreateConfirmation(slots: Record<string, unknown>): string {
    const title = String(slots.title);
    const course = String(slots.course_name);
    const date = formatDeadlineHuman(String(slots.deadline));
    return (
      `Antes de guardar, confirma los datos:\n\n` +
      `📌 *Tarea:* ${title}\n` +
      `📚 *Curso:* ${course}\n` +
      `📅 *Fecha límite:* ${date}\n\n` +
      `¿Todo correcto? Responde *sí* para guardar o *no* para cancelar.`
    );
  }

  presentEditConfirmation(slots: Record<string, unknown>): string {
    const task = String(slots.task_title);
    const fieldLabel =
      slots.field === 'deadline'
        ? 'fecha'
        : slots.field === 'course_name'
          ? 'curso'
          : 'título';
    let newVal = String(slots.new_value);
    if (slots.field === 'deadline') newVal = formatDeadlineHuman(newVal);

    return (
      `Voy a actualizar la tarea *"${task}"*:\n` +
      `• Cambiar ${fieldLabel} → *${newVal}*\n\n` +
      `¿Confirmas? (*sí* / *no*)`
    );
  }

  presentCreated(task: { title: string; course: string; deadline: string }): string {
    return `✅ Listo. Guardé *"${task.title}"* en ${task.course} para el ${task.deadline}.`;
  }

  presentUpdated(taskTitle: string, field: string): string {
    const label = field === 'deadline' ? 'fecha' : field === 'course_name' ? 'curso' : 'título';
    return `✅ Actualicé la ${label} de *"${taskTitle}"*.`;
  }

  presentCancelled(): string {
    return 'Ok, cancelé. Si quieres, podemos empezar de nuevo.';
  }

  presentUnknownCourse(
    invalidName: string,
    snapshot: WhatsAppStudentSnapshot,
  ): string {
    const courses = snapshot?.courses ?? [];
    if (courses.length === 0) {
      return `No encontré el curso *"${invalidName}"* en Mitsyy. Aún no tienes materias registradas.`;
    }
    const list = courses
      .slice(0, 8)
      .map((c, i) => `${i + 1}. ${c.name}${c.code ? ` (${c.code})` : ''}`)
      .join('\n');
    return (
      `No encontré el curso *"${invalidName}"* en Mitsyy.\n\n` +
      `Tus materias:\n${list}\n\n` +
      `Responde con el nombre correcto o el número.`
    );
  }
}
