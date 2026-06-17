import { Injectable, Logger } from '@nestjs/common';

export interface TurnMetrics {
  threadId: string;
  intent: string;
  confidence: number;
  domain: string | null;
  toolName: string | null;
  activeFlow?: string;
  slots?: Record<string, unknown>;
  durationMs: number;
  llmCalls: number;
  estimatedCostUsd?: number;
  success: boolean;
}

@Injectable()
export class WhatsAppMetricsService {
  private readonly logger = new Logger('WhatsAppMetrics');

  recordTurn(metrics: TurnMetrics): void {
    this.logger.log(
      JSON.stringify({
        event: 'whatsapp_turn',
        threadId: metrics.threadId,
        intent: metrics.intent,
        confidence: metrics.confidence,
        domain: metrics.domain,
        tool: metrics.toolName,
        activeFlow: metrics.activeFlow,
        slots: metrics.slots,
        durationMs: metrics.durationMs,
        llmCalls: metrics.llmCalls,
        estimatedCostUsd: metrics.estimatedCostUsd,
        success: metrics.success,
      }),
    );
  }
}
