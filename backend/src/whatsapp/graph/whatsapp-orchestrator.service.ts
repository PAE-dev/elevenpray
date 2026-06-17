import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '../../users/entities/user.entity';
import { shouldUseSupervisor, type WhatsAppConfig } from '../config/whatsapp.config';
import { ChatDomainHandler } from '../domains/chat/chat.handler';
import { CoursesDomainHandler } from '../domains/courses/courses.handler';
import { CurriculumDomainHandler } from '../domains/curriculum/curriculum.handler';
import { RemindersDomainHandler } from '../domains/reminders/reminders.handler';
import { TasksDomainHandler } from '../domains/tasks/tasks.handler';
import { WhatsAppHistorySummarizerService } from '../memory/history-summarizer.service';
import { WhatsAppContextResolverService } from '../memory/context-resolver.service';
import { WhatsAppGraphCheckpointerService } from '../memory/graph-checkpointer.service';
import { WhatsAppSessionPolicyService } from '../memory/session-policy.service';
import { WhatsAppMetricsService } from '../observability/whatsapp-metrics.service';
import { WhatsAppTraceService } from '../observability/whatsapp-trace.service';
import { WhatsAppResponsePresenter } from '../presentation/whatsapp-response.presenter';
import { WhatsAppFlowGuardService } from '../router/flow-guard.service';
import { WhatsAppSupervisorRouterService } from '../router/supervisor-router.service';
import type { WhatsAppDomain, WhatsAppIntent } from '../router/routing.types';
import {
  activeFlowToIntent,
  intentToDomain,
  toolNameToActiveFlow,
} from '../router/routing.types';
import { WhatsAppSlotStoreService } from '../slots/slot-store.service';
import { WhatsAppLlmService } from '../llm/whatsapp-llm.service';
import { WhatsAppStudentDataService } from '../whatsapp-student-data.service';

@Injectable()
export class WhatsAppOrchestratorService {
  private readonly logger = new Logger(WhatsAppOrchestratorService.name);
  private readonly rolloutPercent: number;
  private readonly contextWindowTurns: number;

  constructor(
    config: ConfigService,
    private readonly router: WhatsAppSupervisorRouterService,
    private readonly flowGuard: WhatsAppFlowGuardService,
    private readonly sessionPolicy: WhatsAppSessionPolicyService,
    private readonly tasksHandler: TasksDomainHandler,
    private readonly coursesHandler: CoursesDomainHandler,
    private readonly curriculumHandler: CurriculumDomainHandler,
    private readonly remindersHandler: RemindersDomainHandler,
    private readonly chatHandler: ChatDomainHandler,
    private readonly presenter: WhatsAppResponsePresenter,
    private readonly slotStore: WhatsAppSlotStoreService,
    private readonly contextResolver: WhatsAppContextResolverService,
    private readonly historySummarizer: WhatsAppHistorySummarizerService,
    private readonly checkpointerService: WhatsAppGraphCheckpointerService,
    private readonly metrics: WhatsAppMetricsService,
    private readonly trace: WhatsAppTraceService,
    private readonly dataService: WhatsAppStudentDataService,
    private readonly llmService: WhatsAppLlmService,
  ) {
    const wa = config.get<WhatsAppConfig>('whatsapp');
    this.rolloutPercent = wa?.supervisorRolloutPercent ?? 100;
    this.contextWindowTurns = wa?.contextWindowTurns ?? 6;
  }

  async run(user: User, userMessage: string): Promise<string> {
    if (!shouldUseSupervisor(user.id, this.rolloutPercent)) {
      this.logger.warn('Supervisor deshabilitado para este usuario por rollout');
    }

    const threadId = this.checkpointerService.buildThreadId(
      user.id,
      user.whatsappPhone,
    );
    const turnId = `${threadId}:${Date.now()}`;
    const startedAt = Date.now();

    return this.trace.span(
      { threadId, turnId, name: 'whatsapp_turn', input: { message: userMessage } },
      async () => {
        this.llmService.invalidateSnapshotCache(user.id);

        const state = await this.slotStore.getState(user.id);
        const sessionCheck = this.sessionPolicy.checkSession(state);
        if (sessionCheck.shouldReset) {
          await this.slotStore.startNewSession(user.id, sessionCheck.sessionId);
        }

        const [pending, recentTurns, summary, lastToolResult, activeFlow] =
          await Promise.all([
            this.slotStore.getPending(user.id),
            this.slotStore.getRecentTurns(user.id),
            this.slotStore.getSummary(user.id),
            this.slotStore.getLastToolResult(user.id),
            this.slotStore.getActiveFlow(user.id),
          ]);

        const classifierContext = {
          userMessage,
          recentTurns: recentTurns ?? [],
          activeFlow: pending
            ? toolNameToActiveFlow(pending.toolName)
            : activeFlow,
          activeIntent: pending
            ? (pending.intent as WhatsAppIntent)
            : activeFlowToIntent(activeFlow),
          slots: pending?.slots ?? {},
          awaitingSlot: pending?.awaitingSlot ?? null,
          awaitingConfirmation: pending?.awaitingConfirmation ?? false,
          lastToolResult,
          conversationSummary: summary,
        };

        const classification = await this.router.classify(classifierContext);
        await this.slotStore.setLastClassification(user.id, classification);

        this.trace.emit({
          threadId,
          turnId,
          name: 'intent_classification',
          metadata: {
            intent: classification.intent,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
            activeFlow: classifierContext.activeFlow,
            slots: classifierContext.slots,
          },
        });

        const guard = this.flowGuard.evaluate(
          classification,
          classifierContext.activeFlow,
        );

        if (guard.action === 'reset_session') {
          await this.slotStore.resetConversation(user.id);
          const reply =
            guard.intent === 'cancelar_reiniciar'
              ? 'Ok, empecemos de nuevo. ¿En qué puedo ayudarte?'
              : this.presenter.presentGreeting(user.name);
          await this.recordTurn(user, threadId, userMessage, reply, {
            intent: guard.intent,
            confidence: guard.confidence,
            domain: 'chat',
            toolName: null,
            llmCalls: 1,
            startedAt,
            activeFlow: 'none',
            slots: {},
          });
          return reply;
        }

        if (guard.action === 'continue_flow' && pending) {
          const domain: WhatsAppDomain =
            pending.toolName === 'schedule_reminder' ? 'reminders' : 'tasks';
          const intent = (pending.intent || guard.intent) as WhatsAppIntent;
          return this.executeDomain(
            user,
            threadId,
            userMessage,
            domain,
            intent,
            startedAt,
            2,
            classifierContext.activeFlow,
            pending.slots,
          );
        }

        if (guard.action === 'needs_clarification') {
          const reply = this.presenter.presentClarification(guard.reasoning);
          await this.recordTurn(user, threadId, userMessage, reply, {
            intent: guard.intent,
            confidence: guard.confidence,
            domain: intentToDomain(guard.intent),
            toolName: null,
            llmCalls: 1,
            startedAt,
            activeFlow: classifierContext.activeFlow,
            slots: classifierContext.slots,
          });
          return reply;
        }

        const route = this.router.route(classification);

        if (route.needsClarification) {
          const reply = this.presenter.presentClarification(route.reasoning);
          await this.recordTurn(user, threadId, userMessage, reply, {
            intent: route.intent,
            confidence: route.confidence,
            domain: route.domain,
            toolName: null,
            llmCalls: 1,
            startedAt,
            activeFlow: classifierContext.activeFlow,
            slots: classifierContext.slots,
          });
          return reply;
        }

        if (route.intent === 'unknown') {
          const reply = this.presenter.presentFallback();
          await this.recordTurn(user, threadId, userMessage, reply, {
            intent: route.intent,
            confidence: route.confidence,
            domain: 'chat',
            toolName: null,
            llmCalls: 1,
            startedAt,
            activeFlow: classifierContext.activeFlow,
            slots: classifierContext.slots,
          });
          return reply;
        }

        if (route.intent === 'saludo_inicio') {
          await this.slotStore.resetConversation(user.id);
          const reply = this.presenter.presentGreeting(user.name);
          await this.recordTurn(user, threadId, userMessage, reply, {
            intent: route.intent,
            confidence: route.confidence,
            domain: 'chat',
            toolName: null,
            llmCalls: 1,
            startedAt,
            activeFlow: 'none',
            slots: {},
          });
          return reply;
        }

        if (route.intent === 'general_chat') {
          const snapshot = await this.llmService.getCachedSnapshot(user.id, () =>
            this.dataService.getSnapshot(user.id),
          );
          const ref = this.contextResolver.resolve(
            userMessage,
            snapshot,
            lastToolResult,
            recentTurns ?? [],
          );
          if (ref.ambiguous) {
            const question = this.contextResolver.buildDisambiguationQuestion(ref);
            if (question) {
              await this.recordTurn(user, threadId, userMessage, question, {
                intent: route.intent,
                confidence: route.confidence,
                domain: route.domain,
                toolName: null,
                llmCalls: 1,
                startedAt,
                activeFlow: classifierContext.activeFlow,
                slots: classifierContext.slots,
              });
              return question;
            }
          }
        }

        return this.executeDomain(
          user,
          threadId,
          userMessage,
          route.domain,
          route.intent,
          startedAt,
          2,
          toolNameToActiveFlow(null),
          {},
        );
      },
    );
  }

  private async executeDomain(
    user: User,
    threadId: string,
    userMessage: string,
    domain: WhatsAppDomain,
    intent: WhatsAppIntent,
    startedAt: number,
    baseLlmCalls: number,
    activeFlow: string,
    slots: Record<string, unknown>,
  ): Promise<string> {
    const handler = this.getDomainHandler(domain);
    const result = await handler.process(user, threadId, { intent, userMessage });
    const reply = result.reply ?? this.presenter.presentFallback();

    await this.recordTurn(user, threadId, userMessage, reply, {
      intent,
      confidence: 1,
      domain,
      toolName: result.toolName ?? null,
      llmCalls: baseLlmCalls + (result.llmCalls ?? 0),
      startedAt,
      activeFlow,
      slots: result.toolArgs ?? slots,
    });

    return reply;
  }

  private async recordTurn(
    user: User,
    threadId: string,
    userMessage: string,
    reply: string,
    meta: {
      intent: string;
      confidence: number;
      domain: string | null;
      toolName: string | null;
      llmCalls: number;
      startedAt: number;
      activeFlow: string;
      slots: Record<string, unknown>;
    },
  ): Promise<void> {
    const durationMs = Date.now() - meta.startedAt;

    await Promise.all([
      this.slotStore.appendTurn(user.id, threadId, 'user', userMessage, this.contextWindowTurns * 2),
      this.slotStore.appendTurn(user.id, threadId, 'assistant', reply, this.contextWindowTurns * 2),
      this.slotStore.touchMessage(user.id),
    ]);
    void this.historySummarizer.maybeSummarize(user.id, threadId);

    this.trace.emit({
      threadId,
      turnId: `${threadId}:${meta.startedAt}`,
      name: 'turn_complete',
      durationMs,
      metadata: {
        intent: meta.intent,
        confidence: meta.confidence,
        activeFlow: meta.activeFlow,
        slots: meta.slots,
        domain: meta.domain,
        toolName: meta.toolName,
        llmCalls: meta.llmCalls,
      },
    });

    this.metrics.recordTurn({
      threadId,
      intent: meta.intent,
      confidence: meta.confidence,
      domain: meta.domain,
      toolName: meta.toolName,
      activeFlow: meta.activeFlow,
      slots: meta.slots,
      durationMs,
      llmCalls: meta.llmCalls,
      success: Boolean(reply),
    });
  }

  private getDomainHandler(domain: WhatsAppDomain) {
    switch (domain) {
      case 'tasks':
        return this.tasksHandler;
      case 'courses':
        return this.coursesHandler;
      case 'curriculum':
        return this.curriculumHandler;
      case 'reminders':
        return this.remindersHandler;
      default:
        return this.chatHandler;
    }
  }
}
