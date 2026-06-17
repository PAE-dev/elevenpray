import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppConfig } from '../config/whatsapp.config';
import type { WhatsAppConversationState } from '../memory/entities/whatsapp-conversation-state.entity';
import { randomUUID } from 'crypto';

export interface SessionCheckResult {
  expired: boolean;
  sessionId: string;
  shouldReset: boolean;
}

@Injectable()
export class WhatsAppSessionPolicyService {
  private readonly sessionTimeoutMs: number;

  constructor(config: ConfigService) {
    const wa = config.get<WhatsAppConfig>('whatsapp');
    const hours = wa?.sessionTimeoutHours ?? 6;
    this.sessionTimeoutMs = hours * 60 * 60 * 1000;
  }

  checkSession(state: WhatsAppConversationState | null): SessionCheckResult {
    const now = Date.now();
    const sessionId = state?.sessionId ?? randomUUID();

    if (!state?.lastMessageAt) {
      return { expired: false, sessionId, shouldReset: false };
    }

    const lastAt = state.lastMessageAt.getTime();
    const expired = now - lastAt > this.sessionTimeoutMs;

    return {
      expired,
      sessionId: expired ? randomUUID() : sessionId,
      shouldReset: expired,
    };
  }

  touchTimestamp(): Date {
    return new Date();
  }
}
