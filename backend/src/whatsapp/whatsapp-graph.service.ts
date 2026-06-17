import { Injectable } from '@nestjs/common';
import type { User } from '../users/entities/user.entity';
import { WhatsAppOrchestratorService } from './graph/whatsapp-orchestrator.service';

/** Facade retrocompatible — delega al orquestador supervisor. */
@Injectable()
export class WhatsAppGraphService {
  constructor(private readonly orchestrator: WhatsAppOrchestratorService) {}

  async run(user: User, userMessage: string): Promise<string> {
    return this.orchestrator.run(user, userMessage);
  }
}
