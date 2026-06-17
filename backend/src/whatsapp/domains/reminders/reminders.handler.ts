import { Injectable } from '@nestjs/common';
import type { User } from '../../../users/entities/user.entity';
import type { WhatsAppGraphStateType } from '../../graph/whatsapp.graph.state';
import { WhatsAppResponsePresenter } from '../../presentation/whatsapp-response.presenter';
import { intentToToolName } from '../../router/routing.types';
import { WhatsAppSlotExtractorService } from '../../slots/slot-extractor.service';
import { WhatsAppSlotManagerService } from '../../slots/slot-manager.service';
import { WhatsAppSlotStoreService } from '../../slots/slot-store.service';
import { WhatsAppToolExecutorService } from '../../tools/tool-executor.service';
import { ReminderQueueService } from '../../queue/reminder-queue.service';

@Injectable()
export class RemindersDomainHandler {
  constructor(
    private readonly executor: WhatsAppToolExecutorService,
    private readonly slotExtractor: WhatsAppSlotExtractorService,
    private readonly slotManager: WhatsAppSlotManagerService,
    private readonly slotStore: WhatsAppSlotStoreService,
    private readonly presenter: WhatsAppResponsePresenter,
    private readonly reminderQueue: ReminderQueueService,
  ) {}

  async process(
    user: User,
    threadId: string,
    state: Pick<WhatsAppGraphStateType, 'intent' | 'userMessage'>,
  ): Promise<Partial<WhatsAppGraphStateType>> {
    const toolName = intentToToolName(state.intent)!;
    const tool = this.executor.getByName(toolName)!;
    const pending = await this.slotStore.getPending(user.id);
    const existingSlots = pending?.toolName === tool.name ? pending.slots : {};

    const [recentTurns, summary] = await Promise.all([
      this.slotStore.getRecentTurns(user.id),
      this.slotStore.getSummary(user.id),
    ]);

    const extracted = await this.slotExtractor.extract(tool, {
      userMessage: state.userMessage,
      existingSlots,
      recentTurns: recentTurns ?? [],
      awaitingSlot: pending?.awaitingSlot ?? null,
      awaitingConfirmation: pending?.awaitingConfirmation ?? false,
      conversationSummary: summary,
    });

    const evaluation = this.slotManager.evaluate(
      tool,
      pending,
      extracted,
      state.userMessage,
    );

    if (evaluation.action === 'cancel') {
      await this.slotStore.clearPending(user.id);
      return { reply: evaluation.message!, phase: 'done', llmCalls: 1 };
    }

    if (evaluation.action === 'ask') {
      await this.slotStore.savePending(user.id, threadId, {
        toolName: tool.name,
        intent: state.intent,
        slots: evaluation.mergedSlots,
        awaitingConfirmation: false,
        awaitingSlot: evaluation.missingSlot,
      });
      return {
        toolName: tool.name,
        toolArgs: evaluation.mergedSlots,
        reply: this.presenter.presentSlotQuestion(tool, evaluation.missingSlot!),
        phase: 'slots',
        llmCalls: 1,
      };
    }

    if (evaluation.action === 'confirm') {
      await this.slotStore.savePending(user.id, threadId, {
        toolName: tool.name,
        intent: state.intent,
        slots: evaluation.mergedSlots,
        awaitingConfirmation: true,
        awaitingSlot: undefined,
      });
      return {
        toolName: tool.name,
        toolArgs: evaluation.mergedSlots,
        reply: this.presenter.presentConfirmation(tool, evaluation.mergedSlots),
        phase: 'confirm',
        llmCalls: 1,
      };
    }

    const result = await this.executor.execute(user, tool.name, evaluation.mergedSlots);
    await this.slotStore.clearPending(user.id);
    await this.slotStore.setLastToolResult(user.id, result.data);

    const reminderData = result.data as {
      success?: boolean;
      reminder?: { id?: string; remindAtIso?: string };
    };
    if (result.success && reminderData.reminder?.id) {
      const iso =
        reminderData.reminder.remindAtIso ??
        (evaluation.mergedSlots.remind_at as string);
      await this.reminderQueue.scheduleDelivery(
        reminderData.reminder.id,
        user.id,
        iso,
      );
    }

    return {
      toolName: tool.name,
      toolArgs: evaluation.mergedSlots,
      toolResult: result.data,
      reply: this.presenter.presentToolResult(state.intent, result.data),
      phase: 'done',
      llmCalls: 1,
    };
  }
}
