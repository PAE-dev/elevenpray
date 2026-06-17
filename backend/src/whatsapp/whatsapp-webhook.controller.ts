import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import type { WhatsAppWebhookPayload } from './whatsapp.types';

@Controller('whatsapp/webhook')
export class WhatsAppWebhookController {
  constructor(private readonly service: WhatsAppService) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = this.service.verifyWebhook(mode, verifyToken, challenge);
    if (result == null) {
      throw new ForbiddenException('Token de verificación inválido');
    }
    return res.status(200).send(result);
  }

  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() payload: WhatsAppWebhookPayload) {
    await this.service.handleIncomingWebhook(payload);
    return { ok: true };
  }
}
