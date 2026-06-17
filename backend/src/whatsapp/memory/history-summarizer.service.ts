import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppConfig } from '../config/whatsapp.config';
import { WhatsAppLlmService } from '../llm/whatsapp-llm.service';
import { WhatsAppSlotStoreService } from '../slots/slot-store.service';

@Injectable()
export class WhatsAppHistorySummarizerService {
  private readonly threshold: number;

  constructor(
    config: ConfigService,
    private readonly llmService: WhatsAppLlmService,
    private readonly slotStore: WhatsAppSlotStoreService,
  ) {
    const wa = config.get<WhatsAppConfig>('whatsapp');
    this.threshold = wa?.historyTurnThreshold ?? 20;
  }

  async maybeSummarize(userId: string, threadId: string): Promise<string | null> {
    const turns = await this.slotStore.getRecentTurns(userId);
    if (turns.length < this.threshold) {
      return null;
    }

    const existing = await this.slotStore.getSummary(userId);
    const llm = this.llmService.createChat('fast', 0);
    const transcript = turns.map((t) => `${t.role}: ${t.content}`).join('\n');
    const response = await llm.invoke([
      {
        role: 'system',
        content:
          'Resume la conversación entre estudiante y asistente Mitsyy en 3-5 oraciones en español. Conserva hechos: cursos, tareas, fechas mencionadas.',
      },
      {
        role: 'user',
        content: existing
          ? `Resumen previo: ${existing}\n\nNuevos turnos:\n${transcript}`
          : transcript,
      },
    ]);

    const summary =
      typeof response.content === 'string'
        ? response.content
        : String(response.content);

    await this.slotStore.setSummary(userId, summary);
    return summary;
  }
}
