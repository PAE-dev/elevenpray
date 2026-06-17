import { WhatsAppSessionPolicyService } from './session-policy.service';
import type { WhatsAppConversationState } from './entities/whatsapp-conversation-state.entity';

describe('WhatsAppSessionPolicyService', () => {
  const policy = new WhatsAppSessionPolicyService({
    get: () => ({ sessionTimeoutHours: 6 }),
  } as never);

  it('detecta sesión expirada tras timeout', () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
    const state = {
      sessionId: 'old-session',
      lastMessageAt: sevenHoursAgo,
    } as WhatsAppConversationState;

    const result = policy.checkSession(state);
    expect(result.expired).toBe(true);
    expect(result.shouldReset).toBe(true);
    expect(result.sessionId).not.toBe('old-session');
  });

  it('mantiene sesión activa dentro del timeout', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const state = {
      sessionId: 'active-session',
      lastMessageAt: oneHourAgo,
    } as WhatsAppConversationState;

    const result = policy.checkSession(state);
    expect(result.expired).toBe(false);
    expect(result.shouldReset).toBe(false);
    expect(result.sessionId).toBe('active-session');
  });
});
