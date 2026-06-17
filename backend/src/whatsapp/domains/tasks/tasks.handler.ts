import { Injectable } from '@nestjs/common';
import type { User } from '../../../users/entities/user.entity';
import type { WhatsAppGraphStateType } from '../../graph/whatsapp.graph.state';
import { TaskFlowPresenter } from '../../presentation/task-flow.presenter';
import type { TaskSlotName } from '../../presentation/task-flow.presenter';
import { intentToToolName } from '../../router/routing.types';
import type { WhatsAppIntent } from '../../router/routing.types';
import { parseColloquialDate } from '../../slots/date-parser';
import { resolveCourseInSnapshot } from '../../slots/course-resolver';
import { WhatsAppSlotExtractorService } from '../../slots/slot-extractor.service';
import { WhatsAppSlotManagerService } from '../../slots/slot-manager.service';
import type { SlotManagerResult } from '../../slots/slot.types';
import { WhatsAppSlotStoreService } from '../../slots/slot-store.service';
import { WhatsAppToolExecutorService } from '../../tools/tool-executor.service';
import { WhatsAppStudentDataService, type WhatsAppStudentSnapshot } from '../../whatsapp-student-data.service';
import { WhatsAppResponsePresenter } from '../../presentation/whatsapp-response.presenter';

@Injectable()
export class TasksDomainHandler {
  constructor(
    private readonly executor: WhatsAppToolExecutorService,
    private readonly slotExtractor: WhatsAppSlotExtractorService,
    private readonly slotManager: WhatsAppSlotManagerService,
    private readonly slotStore: WhatsAppSlotStoreService,
    private readonly taskPresenter: TaskFlowPresenter,
    private readonly presenter: WhatsAppResponsePresenter,
    private readonly dataService: WhatsAppStudentDataService,
  ) {}

  async process(
    user: User,
    threadId: string,
    state: Pick<WhatsAppGraphStateType, 'intent' | 'userMessage'>,
  ): Promise<Partial<WhatsAppGraphStateType>> {
    const toolName = intentToToolName(state.intent);
    if (!toolName) {
      return { reply: this.presenter.presentFallback(), phase: 'done', llmCalls: 0 };
    }

    const tool = this.executor.getByName(toolName)!;

    if (tool.kind === 'read') {
      const result = await this.executor.execute(user, toolName, {});
      await this.slotStore.setLastToolResult(user.id, result.data);
      return {
        toolName,
        toolResult: result.data,
        reply: this.presenter.presentToolResult(state.intent, result.data),
        phase: 'done',
        llmCalls: 0,
      };
    }

    return this.processWrite(user, threadId, state.intent, state.userMessage, tool.name);
  }

  private async processWrite(
    user: User,
    threadId: string,
    intent: WhatsAppIntent,
    userMessage: string,
    toolName: string,
  ): Promise<Partial<WhatsAppGraphStateType>> {
    const tool = this.executor.getByName(toolName)!;
    const snapshot = await this.dataService.getSnapshot(user.id);
    const pending = await this.slotStore.getPending(user.id);
    const existingSlots = pending?.toolName === tool.name ? pending.slots : {};

    const [recentTurns, summary] = await Promise.all([
      this.slotStore.getRecentTurns(user.id),
      this.slotStore.getSummary(user.id),
    ]);

    let messageForSlots = userMessage;
    if (pending?.awaitingSlot) {
      messageForSlots = this.resolveListSelection(
        userMessage,
        pending.awaitingSlot,
        snapshot,
      );
    }

    const extracted = await this.slotExtractor.extract(tool, {
      userMessage: messageForSlots,
      existingSlots,
      recentTurns: recentTurns ?? [],
      awaitingSlot: pending?.awaitingSlot ?? null,
      awaitingConfirmation: pending?.awaitingConfirmation ?? false,
      conversationSummary: summary,
    });

    let evaluation = this.slotManager.evaluate(
      tool,
      pending,
      extracted,
      messageForSlots,
    );

    if (tool.name === 'create_task') {
      evaluation = this.applyCourseResolution(evaluation, snapshot);
    }

    if (evaluation.action === 'cancel') {
      await this.slotStore.clearPending(user.id);
      return {
        reply: evaluation.message ?? this.taskPresenter.presentCancelled(),
        phase: 'done',
        llmCalls: 1,
      };
    }

    if (evaluation.action === 'ask') {
      const awaitingSlot = evaluation.missingSlot!;
      await this.slotStore.savePending(user.id, threadId, {
        toolName: tool.name,
        intent,
        slots: evaluation.mergedSlots,
        awaitingConfirmation: false,
        awaitingSlot,
      });
      const reply =
        evaluation.message ??
        this.formatSlotQuestion(
          tool.name,
          awaitingSlot,
          evaluation.mergedSlots,
          snapshot,
          userMessage,
        );
      return {
        toolName: tool.name,
        toolArgs: evaluation.mergedSlots,
        reply,
        phase: 'slots',
        llmCalls: 1,
      };
    }

    if (evaluation.action === 'confirm') {
      await this.slotStore.savePending(user.id, threadId, {
        toolName: tool.name,
        intent,
        slots: evaluation.mergedSlots,
        awaitingConfirmation: true,
        awaitingSlot: undefined,
      });
      return {
        toolName: tool.name,
        toolArgs: evaluation.mergedSlots,
        reply:
          tool.name === 'edit_task'
            ? this.taskPresenter.presentEditConfirmation(evaluation.mergedSlots)
            : this.taskPresenter.presentCreateConfirmation(evaluation.mergedSlots),
        phase: 'confirm',
        llmCalls: 1,
      };
    }

    const result = await this.executor.execute(user, tool.name, evaluation.mergedSlots);
    await this.slotStore.clearPending(user.id);
    await this.slotStore.setLastToolResult(user.id, result.data);

    const data = result.data as Record<string, unknown>;
    let reply: string;
    if (data.error) {
      reply = String(data.error);
    } else if (tool.name === 'edit_task' && data.success) {
      reply = this.taskPresenter.presentUpdated(
        String(evaluation.mergedSlots.task_title),
        String(evaluation.mergedSlots.field),
      );
    } else if (tool.name === 'create_task' && data.success) {
      reply = this.taskPresenter.presentCreated(
        data.task as { title: string; course: string; deadline: string },
      );
    } else {
      reply = this.presenter.presentToolResult(intent, result.data);
    }

    return {
      toolName: tool.name,
      toolArgs: evaluation.mergedSlots,
      toolResult: result.data,
      reply,
      phase: 'done',
      llmCalls: 1,
    };
  }

  private applyCourseResolution(
    evaluation: SlotManagerResult,
    snapshot: WhatsAppStudentSnapshot,
  ): SlotManagerResult {
    const rawCourse = evaluation.mergedSlots.course_name;
    if (!rawCourse || evaluation.action === 'cancel') {
      return evaluation;
    }

    const match = resolveCourseInSnapshot(String(rawCourse), snapshot.courses);
    if (match) {
      return {
        ...evaluation,
        mergedSlots: { ...evaluation.mergedSlots, course_name: match.name },
      };
    }

    const { course_name: _removed, ...slotsWithoutCourse } = evaluation.mergedSlots;
    return {
      action: 'ask',
      missingSlot: 'course_name',
      mergedSlots: slotsWithoutCourse,
      message: this.taskPresenter.presentUnknownCourse(String(rawCourse), snapshot),
    };
  }

  private formatSlotQuestion(
    toolName: string,
    slot: string,
    slots: Record<string, unknown>,
    snapshot: WhatsAppStudentSnapshot,
    userMessage?: string,
  ): string {
    if (toolName === 'create_task' || toolName === 'edit_task') {
      const deadlineMentionedNow = Boolean(
        userMessage && parseColloquialDate(userMessage),
      );
      return this.taskPresenter.presentSlotQuestion(
        slot as TaskSlotName,
        slots,
        snapshot,
        { deadlineMentionedNow },
      );
    }
    return this.presenter.presentSlotQuestion(
      this.executor.getByName(toolName)!,
      slot,
    );
  }

  private resolveListSelection(
    reply: string,
    awaitingSlot: string,
    snapshot: WhatsAppStudentSnapshot,
  ): string {
    const trimmed = reply.trim();
    const num = parseInt(trimmed, 10);
    if (Number.isNaN(num) || num < 1) return reply;

    if (awaitingSlot === 'course_name' && num <= snapshot.courses.length) {
      return snapshot.courses[num - 1].name;
    }
    if (awaitingSlot === 'task_title' && num <= snapshot.tasks.length) {
      return snapshot.tasks[num - 1].title;
    }
    return reply;
  }
}
