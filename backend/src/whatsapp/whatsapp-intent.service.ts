import { Injectable } from '@nestjs/common';
import { WhatsAppSupervisorRouterService } from './router/supervisor-router.service';
import type { ClassifierContext, IntentClassification } from './router/routing.types';

/** @deprecated Usar WhatsAppSupervisorRouterService */
@Injectable()
export class WhatsAppIntentService {
  constructor(private readonly router: WhatsAppSupervisorRouterService) {}

  async classify(userMessage: string): Promise<IntentClassification> {
    const context: ClassifierContext = {
      userMessage,
      recentTurns: [],
      activeFlow: 'none',
      activeIntent: null,
      slots: {},
      awaitingSlot: null,
      awaitingConfirmation: false,
      lastToolResult: null,
      conversationSummary: null,
    };
    return this.router.classify(context);
  }
}
