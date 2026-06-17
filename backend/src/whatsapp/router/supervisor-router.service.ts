import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppConfig } from '../config/whatsapp.config';
import {
  buildClassifierUserPayload,
  INTENT_CLASSIFIER_SYSTEM_PROMPT,
} from './intent-classifier.prompt';
import { IntentClassificationSchema } from './routing.types';
import type {
  ClassifierContext,
  IntentClassification,
  RouteDecision,
  WhatsAppIntent,
} from './routing.types';
import { intentToDomain } from './routing.types';
import { WhatsAppLlmService } from '../llm/whatsapp-llm.service';

@Injectable()
export class WhatsAppSupervisorRouterService {
  private readonly logger = new Logger(WhatsAppSupervisorRouterService.name);
  private readonly confidenceThreshold: number;

  constructor(
    private readonly config: ConfigService,
    private readonly llmService: WhatsAppLlmService,
  ) {
    const wa = this.config.get<WhatsAppConfig>('whatsapp');
    this.confidenceThreshold = wa?.confidenceThreshold ?? 0.55;
  }

  async classify(context: ClassifierContext): Promise<IntentClassification> {
    const llm = this.llmService.createChat('fast', 0);
    const classifier = llm.withStructuredOutput(IntentClassificationSchema, {
      name: 'whatsapp_intent_classification',
      strict: true,
    });

    const userPayload = buildClassifierUserPayload({
      userMessage: context.userMessage,
      recentTurns: context.recentTurns,
      activeFlow: context.activeFlow,
      activeIntent: context.activeIntent,
      slots: context.slots,
      awaitingSlot: context.awaitingSlot,
      awaitingConfirmation: context.awaitingConfirmation,
      lastToolResult: context.lastToolResult,
      conversationSummary: context.conversationSummary,
    });

    const result = await classifier.invoke([
      { role: 'system', content: INTENT_CLASSIFIER_SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ]);

    this.logger.log(
      `Router: ${result.intent} (${result.confidence}) — ${result.reasoning}`,
    );
    return result;
  }

  route(classification: IntentClassification): RouteDecision {
    const domain = intentToDomain(classification.intent);
    const needsClarification =
      classification.intent !== 'general_chat' &&
      classification.intent !== 'unknown' &&
      classification.intent !== 'saludo_inicio' &&
      classification.intent !== 'cancelar_reiniciar' &&
      classification.confidence < this.confidenceThreshold;

    return {
      domain,
      intent: classification.intent,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      needsClarification,
    };
  }

  isReadIntent(intent: WhatsAppIntent): boolean {
    return ['get_courses', 'get_tasks', 'get_curriculum'].includes(intent);
  }

  isWriteIntent(intent: WhatsAppIntent): boolean {
    return ['create_task', 'edit_task', 'schedule_reminder'].includes(intent);
  }
}
