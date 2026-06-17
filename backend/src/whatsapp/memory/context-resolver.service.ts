import { Injectable } from '@nestjs/common';
import type { WhatsAppStudentSnapshot } from '../whatsapp-student-data.service';

export interface ResolvedReference {
  type: 'task' | 'course' | 'none';
  value: string | null;
  ambiguous: boolean;
  candidates?: string[];
}

@Injectable()
export class WhatsAppContextResolverService {
  resolve(
    message: string,
    snapshot: WhatsAppStudentSnapshot,
    lastToolResult: unknown,
    recentTurns: Array<{ role: string; content: string }>,
  ): ResolvedReference {
    const lower = message.toLowerCase();
    const refersToTask =
      /\b(esa tarea|la tarea|esa entrega|mi tarea|la anterior)\b/i.test(lower);
    const refersToCourse =
      /\b(ese curso|el curso|esa materia|la materia|el de ayer)\b/i.test(lower);

    if (refersToTask) {
      const tasks = this.extractTasks(lastToolResult, snapshot);
      if (tasks.length === 1) {
        return { type: 'task', value: tasks[0].title, ambiguous: false };
      }
      if (tasks.length > 1) {
        return {
          type: 'task',
          value: null,
          ambiguous: true,
          candidates: tasks.slice(0, 5).map((t) => t.title),
        };
      }
    }

    if (refersToCourse) {
      const courses = snapshot.courses;
      if (courses.length === 1) {
        return { type: 'course', value: courses[0].name, ambiguous: false };
      }
      const fromHistory = this.findCourseInTurns(recentTurns, courses);
      if (fromHistory) {
        return { type: 'course', value: fromHistory, ambiguous: false };
      }
      if (courses.length > 1) {
        return {
          type: 'course',
          value: null,
          ambiguous: true,
          candidates: courses.slice(0, 5).map((c) => c.name),
        };
      }
    }

    return { type: 'none', value: null, ambiguous: false };
  }

  buildDisambiguationQuestion(ref: ResolvedReference): string | null {
    if (!ref.ambiguous || !ref.candidates?.length) return null;
    const options = ref.candidates.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const label = ref.type === 'task' ? 'tarea' : 'curso';
    return `¿A cuál ${label} te refieres?\n${options}`;
  }

  private extractTasks(
    lastToolResult: unknown,
    snapshot: WhatsAppStudentSnapshot,
  ): Array<{ title: string }> {
    const data = lastToolResult as { tasks?: Array<{ title: string }> } | null;
    if (data?.tasks?.length) return data.tasks;
    return snapshot.tasks.map((t) => ({ title: t.title }));
  }

  private findCourseInTurns(
    turns: Array<{ role: string; content: string }>,
    courses: WhatsAppStudentSnapshot['courses'],
  ): string | null {
    for (let i = turns.length - 1; i >= 0; i--) {
      const content = turns[i].content.toLowerCase();
      for (const course of courses) {
        if (content.includes(course.name.toLowerCase())) {
          return course.name;
        }
      }
    }
    return null;
  }
}
