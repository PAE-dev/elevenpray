import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import type { WhatsAppConfig } from '../config/whatsapp.config';

export type ModelTier = 'fast' | 'capable';

@Injectable()
export class WhatsAppLlmService {
  private readonly fastModel: string;
  private readonly capableModel: string;
  private snapshotCache = new Map<string, { at: number; snapshot: unknown }>();

  constructor(private readonly config: ConfigService) {
    const waConfig = this.config.get<WhatsAppConfig>('whatsapp');
    this.fastModel = waConfig?.fastModel ?? 'gpt-4o-mini';
    this.capableModel = waConfig?.capableModel ?? 'gpt-4o-mini';
  }

  getModel(tier: ModelTier): string {
    return tier === 'fast' ? this.fastModel : this.capableModel;
  }

  createChat(tier: ModelTier, temperature = 0): ChatOpenAI {
    const apiKey = this.config.get<string>('OPENAI_API_KEY') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException('OPENAI_API_KEY no configurado');
    }
    return new ChatOpenAI({
      apiKey,
      model: this.getModel(tier),
      temperature,
    });
  }

  /** Cache del snapshot académico por turno (TTL 60s). */
  getCachedSnapshot<T>(userId: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.snapshotCache.get(userId);
    const now = Date.now();
    if (cached && now - cached.at < 60_000) {
      return Promise.resolve(cached.snapshot as T);
    }
    return loader().then((snapshot) => {
      this.snapshotCache.set(userId, { at: now, snapshot });
      return snapshot;
    });
  }

  invalidateSnapshotCache(userId: string): void {
    this.snapshotCache.delete(userId);
  }
}
