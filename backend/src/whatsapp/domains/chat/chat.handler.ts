import { Injectable } from '@nestjs/common';
import type { User } from '../../../users/entities/user.entity';
import type { WhatsAppGraphStateType } from '../../graph/whatsapp.graph.state';
import { WhatsAppLlmService } from '../../llm/whatsapp-llm.service';
import { WhatsAppResponsePresenter } from '../../presentation/whatsapp-response.presenter';
import { WhatsAppStudentDataService } from '../../whatsapp-student-data.service';
import { WhatsAppSlotStoreService } from '../../slots/slot-store.service';

@Injectable()
export class ChatDomainHandler {
  constructor(
    private readonly llmService: WhatsAppLlmService,
    private readonly dataService: WhatsAppStudentDataService,
    private readonly slotStore: WhatsAppSlotStoreService,
    private readonly presenter: WhatsAppResponsePresenter,
  ) {}

  async process(
    user: User,
    _threadId: string,
    state: Pick<WhatsAppGraphStateType, 'userMessage' | 'intent'>,
  ): Promise<Partial<WhatsAppGraphStateType>> {
    if (state.intent === 'saludo_inicio') {
      return {
        reply: this.presenter.presentGreeting(user.name),
        phase: 'done',
        llmCalls: 0,
      };
    }

    const snapshot = await this.llmService.getCachedSnapshot(user.id, () =>
      this.dataService.getSnapshot(user.id),
    );
    const summary = await this.slotStore.getSummary(user.id);

    const isShort = state.userMessage.trim().length < 80;
    const llm = this.llmService.createChat(isShort ? 'fast' : 'capable', isShort ? 0.3 : 0.5);
    const courseNames = snapshot.courses.map((c) => c.name).join(', ') || 'ninguno';
    const taskCount = snapshot.tasks.length;

    const response = await llm.invoke([
      {
        role: 'system',
        content: `Eres el asistente de estudio de Mitsyy. Estudiante: ${user.name}.
Cursos: ${courseNames}. Tareas pendientes: ${taskCount}.
${summary ? `Contexto previo: ${summary}` : ''}
Responde breve en español (máx. 2 oraciones). No inventes datos académicos.
Si el usuario solo saluda o escribe algo muy corto sin pedir nada concreto, responde genérico sin mencionar cursos ni tareas específicas.`,
      },
      { role: 'user', content: state.userMessage },
    ]);

    const content =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    return {
      reply: this.presenter.presentChatReply(content),
      phase: 'done',
      llmCalls: 1,
    };
  }
}
