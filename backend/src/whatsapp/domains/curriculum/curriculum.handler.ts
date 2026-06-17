import { Injectable } from '@nestjs/common';
import type { User } from '../../../users/entities/user.entity';
import type { WhatsAppGraphStateType } from '../../graph/whatsapp.graph.state';
import { WhatsAppResponsePresenter } from '../../presentation/whatsapp-response.presenter';
import { WhatsAppToolExecutorService } from '../../tools/tool-executor.service';
import { WhatsAppSlotStoreService } from '../../slots/slot-store.service';

@Injectable()
export class CurriculumDomainHandler {
  constructor(
    private readonly executor: WhatsAppToolExecutorService,
    private readonly slotStore: WhatsAppSlotStoreService,
    private readonly presenter: WhatsAppResponsePresenter,
  ) {}

  async process(
    user: User,
    _threadId: string,
    state: Pick<WhatsAppGraphStateType, 'intent' | 'userMessage'>,
  ): Promise<Partial<WhatsAppGraphStateType>> {
    const result = await this.executor.execute(user, 'get_curriculum', {});
    await this.slotStore.setLastToolResult(user.id, result.data);
    return {
      toolName: 'get_curriculum',
      toolResult: result.data,
      reply: this.presenter.presentToolResult(state.intent, result.data),
      phase: 'done',
      llmCalls: 0,
    };
  }
}
