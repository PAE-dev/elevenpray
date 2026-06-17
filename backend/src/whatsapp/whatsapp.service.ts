import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { WhatsAppMetaClient } from './whatsapp-meta.client';
import { WhatsAppGraphService } from './whatsapp-graph.service';
import type { WhatsAppWebhookPayload } from './whatsapp.types';

export interface WhatsAppStatusResponse {
  connected: boolean;
  phone: string | null;
}

const NOT_CONNECTED_REPLY =
  'Hola. Para usar el asistente de Mitsyy, conecta tu número en la app: entra a Asistente WhatsApp y pulsa "Activar asistente".';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly verifyToken: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly metaClient: WhatsAppMetaClient,
    private readonly graphService: WhatsAppGraphService,
    config: ConfigService,
  ) {
    this.verifyToken = config.get<string>('WHATSAPP_VERIFY_TOKEN') ?? '';
  }

  verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
  ): string | null {
    if (!this.verifyToken) {
      throw new ForbiddenException(
        'WHATSAPP_VERIFY_TOKEN no está configurado en el backend',
      );
    }
    if (mode === 'subscribe' && token === this.verifyToken && challenge) {
      return challenge;
    }
    return null;
  }

  async getStatus(userId: string): Promise<WhatsAppStatusResponse> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const phone = user.whatsappPhone ?? null;
    return { connected: phone != null, phone };
  }

  async connect(
    userId: string,
    phone: string,
  ): Promise<{ success: true; phone: string }> {
    const existing = await this.usersRepo.findOne({
      where: { whatsappPhone: phone },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException(
        'Este número ya está vinculado a otra cuenta',
      );
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const previousPhone = user.whatsappPhone;
    user.whatsappPhone = phone;
    await this.usersRepo.save(user);

    try {
      await this.metaClient.sendWelcomeMessage(phone);
    } catch (err) {
      user.whatsappPhone = previousPhone;
      await this.usersRepo.save(user);
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo enviar el mensaje de bienvenida';
      throw new BadRequestException(message);
    }

    return { success: true, phone };
  }

  async disconnect(userId: string): Promise<{ success: true }> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.whatsappPhone = null;
    await this.usersRepo.save(user);
    return { success: true };
  }

  async handleIncomingWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') return;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];
        for (const message of messages) {
          if (message.type !== 'text' || !message.text?.body?.trim()) {
            continue;
          }
          await this.handleIncomingTextMessage(
            message.from,
            message.text.body.trim(),
          );
        }
      }
    }
  }

  private normalizePhoneE164(from: string): string {
    const digits = from.replace(/\D/g, '');
    return `+${digits}`;
  }

  private async findUserByWhatsAppPhone(from: string): Promise<User | null> {
    const e164 = this.normalizePhoneE164(from);
    const direct = await this.usersRepo.findOne({
      where: { whatsappPhone: e164 },
    });
    if (direct) return direct;

    return this.usersRepo
      .createQueryBuilder('user')
      .where("REPLACE(user.whatsapp_phone, '+', '') = :digits", {
        digits: from.replace(/\D/g, ''),
      })
      .getOne();
  }

  private async handleIncomingTextMessage(
    from: string,
    text: string,
  ): Promise<void> {
    try {
      const user = await this.findUserByWhatsAppPhone(from);
      if (!user) {
        await this.metaClient.sendTextMessage(from, NOT_CONNECTED_REPLY);
        return;
      }

      this.logger.debug(
        `WhatsApp mensaje de ${from} → usuario Mitsyy ${user.id} (${user.email})`,
      );

      const reply = await this.graphService.run(user, text);
      await this.metaClient.sendTextMessage(from, reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error procesando mensaje WhatsApp de ${from}: ${message}`);

      const isMetaAuth =
        message.includes('[WhatsApp Meta]') &&
        message.toLowerCase().includes('token');
      const isOpenAiAuth = message.includes('[OpenAI]');

      if (isMetaAuth) {
        this.logger.error(
          'No se puede responder: WHATSAPP_ACCESS_TOKEN expirado. Genera uno nuevo en Meta Developers.',
        );
        return;
      }

      const userFacing = isOpenAiAuth
        ? 'Tuve un problema con el servicio de IA. Intenta de nuevo en unos minutos.'
        : 'Tuve un problema procesando tu mensaje. Intenta de nuevo en unos minutos.';

      try {
        await this.metaClient.sendTextMessage(from, userFacing);
      } catch (sendErr) {
        const sendMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        this.logger.error(`No se pudo enviar mensaje de error a ${from}: ${sendMsg}`);
      }
    }
  }
}
