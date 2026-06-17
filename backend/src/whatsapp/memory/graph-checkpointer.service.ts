import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';

@Injectable()
export class WhatsAppGraphCheckpointerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppGraphCheckpointerService.name);
  private checkpointer: BaseCheckpointSaver | null = null;
  private setupPromise: Promise<BaseCheckpointSaver> | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    void this.getCheckpointer().catch((err) => {
      this.logger.warn(
        `Checkpointer no precalentado: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async getCheckpointer(): Promise<BaseCheckpointSaver> {
    if (this.checkpointer) return this.checkpointer;
    if (this.setupPromise) return this.setupPromise;

    this.setupPromise = this.init();
    this.checkpointer = await this.setupPromise;
    return this.checkpointer;
  }

  private async init(): Promise<BaseCheckpointSaver> {
    const databaseUrl = this.config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL requerido para checkpointer Postgres');
    }

    const saver = PostgresSaver.fromConnString(databaseUrl);
    await saver.setup();
    this.logger.log('Checkpointer Postgres inicializado');
    return saver;
  }

  buildThreadId(userId: string, whatsappPhone: string | null): string {
    return whatsappPhone ? `wa:${whatsappPhone}` : `user:${userId}`;
  }

  async onModuleDestroy(): Promise<void> {
    this.checkpointer = null;
    this.setupPromise = null;
  }
}
