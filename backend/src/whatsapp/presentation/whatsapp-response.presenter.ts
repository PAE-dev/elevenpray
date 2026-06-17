import { Injectable } from '@nestjs/common';
import type { WhatsAppIntent } from '../router/routing.types';
import type { ToolRegistryEntry } from '../tools/tool.registry';
import { sanitizeToolResult } from './response-policy';

@Injectable()
export class WhatsAppResponsePresenter {
  presentGreeting(userName: string): string {
    const name = userName.split(' ')[0] || userName;
    return `¡Hola, ${name}! ¿En qué puedo ayudarte hoy? Puedo mostrarte cursos, tareas, malla o agendar recordatorios.`;
  }

  presentClarification(reason: string): string {
    return `No estoy seguro de qué necesitas. ${reason} ¿Puedes ser más específico?`;
  }

  presentFallback(): string {
    return 'No entendí bien tu mensaje. Puedo ayudarte con cursos, tareas, malla o recordatorios.';
  }

  presentSlotQuestion(tool: ToolRegistryEntry, slot: string): string {
    return tool.slotPrompts[slot] ?? `¿Cuál es el valor de ${slot}?`;
  }

  presentConfirmation(
    tool: ToolRegistryEntry,
    args: Record<string, unknown>,
  ): string {
    if (tool.name === 'create_task') {
      return `Voy a crear la tarea "${args.title}" para ${args.course_name} con fecha ${args.deadline}. ¿Confirmas? (sí/no)`;
    }
    if (tool.name === 'schedule_reminder') {
      return `Voy a agendar el recordatorio "${args.title}" para ${args.remind_at}. ¿Confirmas? (sí/no)`;
    }
    return `Voy a ejecutar ${tool.description}. ¿Confirmas? (sí/no)`;
  }

  presentToolResult(intent: WhatsAppIntent, rawResult: unknown): string {
    const data = sanitizeToolResult(rawResult) as Record<string, unknown>;

    if (data.error) {
      return String(data.error);
    }

    if (intent === 'get_courses') {
      const courses = data.courses as Array<{ name: string }> | undefined;
      if (!courses?.length) {
        return 'No tienes cursos registrados en Mitsyy todavía.';
      }
      const lines = courses.map((c, i) => `${i + 1}. ${c.name}`);
      const total = typeof data.total === 'number' ? data.total : courses.length;
      return `Tienes ${total} materia${total === 1 ? '' : 's'} este ciclo:\n${lines.join('\n')}`;
    }

    if (intent === 'get_tasks') {
      const tasks = data.tasks as Array<{ title: string; course: string; deadline: string }> | undefined;
      if (!tasks?.length) {
        return String(data.message ?? 'No tienes tareas pendientes.');
      }
      return `Tus tareas pendientes:\n${tasks
        .map((t, i) => `${i + 1}. ${t.title} — ${t.course} (${t.deadline})`)
        .join('\n')}`;
    }

    if (intent === 'get_curriculum') {
      const courses = data.courses as Array<{ name: string; status: string; cycleNumber: number }> | undefined;
      if (!courses?.length) {
        return String(data.message ?? 'No tienes malla configurada.');
      }
      const lines = courses.map((c) => `• ${c.name} — ciclo ${c.cycleNumber} (${c.status})`);
      return `Tu malla curricular:\n${lines.join('\n')}`;
    }

    if (intent === 'create_task' && data.success) {
      const task = data.task as { title: string; course: string; deadline: string };
      return `Listo, guardé la tarea "${task.title}" de ${task.course} para ${task.deadline}.`;
    }

    if (intent === 'schedule_reminder' && data.success) {
      const reminder = data.reminder as { title: string; remindAt: string };
      return `Recordatorio agendado: "${reminder.title}" para ${reminder.remindAt}.`;
    }

    return 'Operación completada.';
  }

  presentChatReply(content: string): string {
    return content.trim();
  }
}
