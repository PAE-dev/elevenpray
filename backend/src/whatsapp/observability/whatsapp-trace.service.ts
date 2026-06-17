import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppConfig } from '../config/whatsapp.config';

export interface TraceSpan {
  threadId: string;
  turnId: string;
  name: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WhatsAppTraceService {
  private readonly logger = new Logger('WhatsAppTrace');
  private readonly provider: WhatsAppConfig['traceProvider'];

  constructor(config: ConfigService) {
    this.provider =
      config.get<WhatsAppConfig['traceProvider']>('whatsapp.traceProvider') ??
      'none';
  }

  async span<T>(
    meta: Omit<TraceSpan, 'output' | 'durationMs'>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await fn();
      this.emit({
        ...meta,
        durationMs: Date.now() - startedAt,
        output: { ok: true },
      });
      return result;
    } catch (err) {
      this.emit({
        ...meta,
        durationMs: Date.now() - startedAt,
        output: {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  emit(span: TraceSpan): void {
    if (this.provider === 'none') {
      this.logger.debug(JSON.stringify({ event: 'trace', ...span }));
      return;
    }

    // LangSmith/Langfuse: variables de entorno estándar (LANGCHAIN_TRACING_V2, etc.)
    this.logger.log(
      JSON.stringify({
        event: 'trace',
        provider: this.provider,
        ...span,
      }),
    );
  }
}
