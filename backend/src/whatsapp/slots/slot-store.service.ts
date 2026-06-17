import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import type { WhatsAppConfig } from '../config/whatsapp.config';
import { WhatsAppConversationState } from '../memory/entities/whatsapp-conversation-state.entity';
import type { ActiveFlow, IntentClassification } from '../router/routing.types';
import { toolNameToActiveFlow } from '../router/routing.types';
import type { SlotFillState } from './slot.types';
import {
  hasValidCreateTaskSlots,
  sanitizeSlotsForTool,
} from './slot-value-validator';

@Injectable()
export class WhatsAppSlotStoreService {
  private readonly pendingFlowTtlMs: number;

  constructor(
    @InjectRepository(WhatsAppConversationState)
    private readonly repo: Repository<WhatsAppConversationState>,
    config: ConfigService,
  ) {
    const wa = config.get<WhatsAppConfig>('whatsapp');
    const minutes = wa?.pendingFlowTtlMinutes ?? 30;
    this.pendingFlowTtlMs = minutes * 60 * 1000;
  }

  async getState(userId: string): Promise<WhatsAppConversationState | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async getOrCreate(userId: string, threadId: string): Promise<WhatsAppConversationState> {
    let state = await this.repo.findOne({ where: { userId } });
    if (!state) {
      const now = new Date();
      state = this.repo.create({
        userId,
        threadId,
        pendingSlots: {},
        recentTurns: [],
        awaitingConfirmation: false,
        activeFlow: 'none',
        sessionId: randomUUID(),
        sessionStartedAt: now,
        lastMessageAt: now,
      });
      state = await this.repo.save(state);
    }
    return state;
  }

  async savePending(
    userId: string,
    threadId: string,
    pending: SlotFillState,
  ): Promise<void> {
    const state = await this.getOrCreate(userId, threadId);
    state.pendingIntent = pending.intent;
    state.pendingTool = pending.toolName;
    state.pendingSlots = pending.slots;
    state.awaitingConfirmation = pending.awaitingConfirmation;
    state.awaitingSlot = pending.awaitingSlot ?? null;
    state.activeFlow = toolNameToActiveFlow(pending.toolName);
    await this.repo.save(state);
  }

  async clearPending(userId: string): Promise<void> {
    const state = await this.repo.findOne({ where: { userId } });
    if (!state) return;
    state.pendingIntent = null;
    state.pendingTool = null;
    state.pendingSlots = {};
    state.awaitingConfirmation = false;
    state.awaitingSlot = null;
    state.activeFlow = 'none';
    await this.repo.save(state);
  }

  /** Limpia flujo pendiente, historial y resumen — chat nuevo. */
  async resetConversation(userId: string, newSessionId?: string): Promise<void> {
    const state = await this.repo.findOne({ where: { userId } });
    if (!state) return;
    const now = new Date();
    state.pendingIntent = null;
    state.pendingTool = null;
    state.pendingSlots = {};
    state.awaitingConfirmation = false;
    state.awaitingSlot = null;
    state.conversationSummary = null;
    state.recentTurns = [];
    state.lastToolResult = null;
    state.activeFlow = 'none';
    state.lastClassification = null;
    state.sessionId = newSessionId ?? randomUUID();
    state.sessionStartedAt = now;
    state.lastMessageAt = now;
    await this.repo.save(state);
  }

  async startNewSession(userId: string, sessionId: string): Promise<void> {
    await this.resetConversation(userId, sessionId);
  }

  async touchMessage(userId: string): Promise<void> {
    const state = await this.repo.findOne({ where: { userId } });
    if (!state) return;
    state.lastMessageAt = new Date();
    await this.repo.save(state);
  }

  async setLastClassification(
    userId: string,
    classification: IntentClassification,
  ): Promise<void> {
    const state = await this.repo.findOne({ where: { userId } });
    if (!state) return;
    state.lastClassification = {
      intent: classification.intent,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    };
    await this.repo.save(state);
  }

  async getActiveFlow(userId: string): Promise<ActiveFlow> {
    const state = await this.repo.findOne({ where: { userId } });
    return (state?.activeFlow as ActiveFlow) ?? 'none';
  }

  async getPending(userId: string): Promise<SlotFillState | null> {
    const state = await this.repo.findOne({ where: { userId } });
    if (!state?.pendingTool) return null;

    if (
      state.updatedAt &&
      Date.now() - state.updatedAt.getTime() > this.pendingFlowTtlMs
    ) {
      await this.clearPending(userId);
      return null;
    }

    const slots = sanitizeSlotsForTool(
      state.pendingTool,
      (state.pendingSlots ?? {}) as Record<string, unknown>,
    );
    let awaitingConfirmation = state.awaitingConfirmation;

    if (
      state.pendingTool === 'create_task' &&
      awaitingConfirmation &&
      !hasValidCreateTaskSlots(slots)
    ) {
      awaitingConfirmation = false;
    }

    const slotsChanged =
      JSON.stringify(slots) !== JSON.stringify(state.pendingSlots ?? {});
    if (slotsChanged || awaitingConfirmation !== state.awaitingConfirmation) {
      state.pendingSlots = slots;
      state.awaitingConfirmation = awaitingConfirmation;
      await this.repo.save(state);
    }

    return {
      toolName: state.pendingTool,
      intent: state.pendingIntent ?? '',
      slots,
      awaitingConfirmation,
      awaitingSlot: state.awaitingSlot ?? undefined,
    };
  }

  async appendTurn(
    userId: string,
    threadId: string,
    role: 'user' | 'assistant',
    content: string,
    maxTurns: number,
  ): Promise<void> {
    const state = await this.getOrCreate(userId, threadId);
    const turns = [...(state.recentTurns ?? []), { role, content, at: new Date().toISOString() }];
    state.recentTurns = turns.slice(-maxTurns);
    state.lastMessageAt = new Date();
    await this.repo.save(state);
  }

  async setLastToolResult(userId: string, result: unknown): Promise<void> {
    const state = await this.repo.findOne({ where: { userId } });
    if (!state) return;
    state.lastToolResult = result;
    await this.repo.save(state);
  }

  async getRecentTurns(userId: string): Promise<WhatsAppConversationState['recentTurns']> {
    const state = await this.repo.findOne({ where: { userId } });
    return state?.recentTurns ?? [];
  }

  async getLastToolResult(userId: string): Promise<unknown> {
    const state = await this.repo.findOne({ where: { userId } });
    return state?.lastToolResult ?? null;
  }

  async setSummary(userId: string, summary: string): Promise<void> {
    const state = await this.repo.findOne({ where: { userId } });
    if (!state) return;
    state.conversationSummary = summary;
    await this.repo.save(state);
  }

  async getSummary(userId: string): Promise<string | null> {
    const state = await this.repo.findOne({ where: { userId } });
    return state?.conversationSummary ?? null;
  }
}
