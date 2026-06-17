import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '../../users/entities/user.entity';
import { WhatsAppToolsService } from '../whatsapp-tools.service';
import type { WhatsAppStudentSnapshot } from '../whatsapp-student-data.service';

const SYSTEM_PROMPT = `Eres el asistente de estudio de Mitsyy para estudiantes universitarios peruanos.
Responde siempre en español, breve y claro (máximo 3 párrafos cortos).

REGLAS CRÍTICAS:
1. Tienes datos reales del estudiante en "DATOS_ACTUALES" — úsalos para responder consultas.
2. Para crear tareas o recordatorios, USA las herramientas create_task y schedule_reminder.
3. NUNCA inventes cursos, tareas ni fechas que no estén en DATOS_ACTUALES o en el resultado de una herramienta.
4. Si DATOS_ACTUALES está vacío, dilo claramente y sugiere agregar cursos/tareas en la app Mitsyy.
5. Formatea listas de forma legible en WhatsApp (viñetas cortas).`;

export const WHATSAPP_AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_tasks',
      description: 'Lista tareas del estudiante desde la base de datos de Mitsyy',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'all'] },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_task',
      description: 'Crea una tarea académica en Mitsyy',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          course_name: { type: 'string' },
          deadline: { type: 'string', description: 'ISO date e.g. 2026-06-20' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        },
        required: ['title', 'course_name', 'deadline'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_courses',
      description: 'Lista cursos/materias del estudiante en Mitsyy',
      parameters: {
        type: 'object',
        properties: {
          cycle_number: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_curriculum',
      description: 'Obtiene la malla curricular completa del estudiante',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_reminder',
      description: 'Agenda un recordatorio para el estudiante',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          remind_at: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['title', 'remind_at'],
      },
    },
  },
];

type ChatMessage = Record<string, unknown>;

@Injectable()
export class WhatsAppAgentService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly toolsService: WhatsAppToolsService,
  ) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY') ?? '';
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
  }

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'OpenAI no está configurado (OPENAI_API_KEY). Revisa backend/.env',
      );
    }
  }

  private buildSystemPrompt(user: User, snapshot: WhatsAppStudentSnapshot): string {
    const parts = [SYSTEM_PROMPT, `Estudiante: ${user.name}.`];
    if (user.studentUniversity) parts.push(`Universidad: ${user.studentUniversity}.`);
    if (user.studentCareer) parts.push(`Carrera: ${user.studentCareer}.`);
    if (user.studentAcademicCycle) parts.push(`Ciclo: ${user.studentAcademicCycle}.`);
    const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    parts.push(`Fecha/hora actual (Lima): ${now}.`);
    parts.push(`DATOS_ACTUALES:\n${JSON.stringify(snapshot, null, 2)}`);
    return parts.join('\n');
  }

  private detectForcedTool(
    message: string,
  ): { name: string; args: Record<string, unknown> } | null {
    const m = message.toLowerCase();
    if (/tareas?|pendientes?|entregas?|assignments?/.test(m)) {
      return { name: 'list_tasks', args: { status: 'pending' } };
    }
    if (/materias?|cursos?|asignaturas?/.test(m) && /malla|curriculum|curricular/.test(m)) {
      return { name: 'get_curriculum', args: {} };
    }
    if (/materias?|cursos?|asignaturas?/.test(m)) {
      return { name: 'list_courses', args: {} };
    }
    if (/malla|curriculum|curricular|cr[eé]ditos?/.test(m)) {
      return { name: 'get_curriculum', args: {} };
    }
    return null;
  }

  private formatDirectAnswer(toolName: string, result: unknown): string | null {
    const data = result as Record<string, unknown>;
    if (toolName === 'list_courses') {
      const courses = data.courses as Array<{ name: string; code: string | null; status?: string }>;
      if (!courses?.length) return String(data.message ?? 'No tienes cursos en Mitsyy.');
      const lines = courses.map(
        (c, i) => `${i + 1}. ${c.name}${c.code ? ` (${c.code})` : ''}`,
      );
      return `Tus materias este ciclo:\n${lines.join('\n')}`;
    }
    if (toolName === 'list_tasks') {
      const tasks = data.tasks as Array<{ title: string; course: string; deadline: string; priority: string }>;
      if (!tasks?.length) return String(data.message ?? 'No tienes tareas pendientes.');
      const lines = tasks.map(
        (t, i) => `${i + 1}. ${t.title} — ${t.course} (📅 ${t.deadline})`,
      );
      return `Tus tareas pendientes:\n${lines.join('\n')}`;
    }
    if (toolName === 'get_curriculum') {
      const courses = data.courses as Array<{ name: string; status: string; cycleNumber: number }>;
      if (!courses?.length) return String(data.message ?? 'No tienes malla configurada.');
      const lines = courses.map(
        (c) => `• ${c.name} — ciclo ${c.cycleNumber} (${c.status})`,
      );
      return `Tu malla curricular:\n${lines.join('\n')}`;
    }
    return null;
  }

  private async chatCompletion(body: Record<string, unknown>) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseBody = (await res.json().catch(() => ({}))) as {
      choices?: Array<{ message?: Record<string, unknown>; finish_reason?: string }>;
      error?: { message?: string; type?: string };
    };

    if (!res.ok) {
      const msg = responseBody.error?.message ?? `OpenAI API error (${res.status})`;
      if (res.status === 401 || msg.toLowerCase().includes('authentication')) {
        throw new ServiceUnavailableException(
          `[OpenAI] Error de autenticación. Verifica OPENAI_API_KEY en backend/.env: ${msg}`,
        );
      }
      throw new InternalServerErrorException(`[OpenAI] ${msg}`);
    }

    return responseBody;
  }

  async generateReply(user: User, userMessage: string): Promise<string> {
    this.ensureConfigured();

    const snapshot = await this.toolsService.getSnapshot(user.id);

    const forced = this.detectForcedTool(userMessage);
    if (forced && !/guard|crea|agenda|recuerda|av[ií]sa/.test(userMessage.toLowerCase())) {
      const result = await this.toolsService.execute(user, forced.name, forced.args);
      const direct = this.formatDirectAnswer(forced.name, result);
      if (direct) return direct;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(user, snapshot) },
      { role: 'user', content: userMessage },
    ];

    for (let step = 0; step < 6; step++) {
      const response = await this.chatCompletion({
        model: this.model,
        temperature: 0.3,
        max_tokens: 600,
        tools: WHATSAPP_AGENT_TOOLS,
        tool_choice: step === 0 && forced ? 'required' : 'auto',
        messages,
      });

      const choice = response.choices?.[0];
      const assistantMessage = choice?.message;
      if (!assistantMessage) {
        throw new InternalServerErrorException('[OpenAI] Respuesta vacía del modelo');
      }

      messages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls as
        | Array<{ id: string; function: { name: string; arguments: string } }>
        | undefined;

      if (toolCalls?.length) {
        for (const toolCall of toolCalls) {
          let result: unknown;
          try {
            const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
            result = await this.toolsService.execute(user, toolCall.function.name, args);
          } catch (err) {
            result = {
              error: err instanceof Error ? err.message : 'Error ejecutando herramienta',
            };
          }
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      const content = String(assistantMessage.content ?? '').trim();
      if (content) return content;
    }

    throw new InternalServerErrorException('[OpenAI] Demasiados pasos de herramientas');
  }
}
