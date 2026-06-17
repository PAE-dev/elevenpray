import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const WELCOME_MESSAGE =
  '¡Hola! Soy tu asistente de estudio en Mitsyy. Puedes escribirme para guardar tareas, recibir recordatorios de exámenes o consultar tus materias. ¿En qué te ayudo hoy?';

@Injectable()
export class WhatsAppMetaClient {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;
  private readonly welcomeTemplate: string | null;
  private readonly welcomeTemplateLang: string;

  constructor(private readonly config: ConfigService) {
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
    this.phoneNumberId =
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '1079929778544374';
    this.apiVersion = this.config.get<string>('WHATSAPP_API_VERSION') ?? 'v25.0';
    const template = this.config.get<string>('WHATSAPP_WELCOME_TEMPLATE') ?? 'hello_world';
    this.welcomeTemplate = template.trim() || null;
    this.welcomeTemplateLang =
      this.config.get<string>('WHATSAPP_WELCOME_TEMPLATE_LANG') ?? 'en_US';
  }

  private ensureConfigured(): void {
    if (!this.accessToken) {
      throw new ServiceUnavailableException(
        'WhatsApp no está configurado (WHATSAPP_ACCESS_TOKEN)',
      );
    }
  }

  private normalizeTo(phone: string): string {
    return phone.replace(/^\+/, '');
  }

  private async postMessage(body: Record<string, unknown>): Promise<void> {
    this.ensureConfigured();

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseBody = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const metaError =
        (responseBody.error as { message?: string; code?: number } | undefined)?.message ??
        String(responseBody.error ?? `WhatsApp API error (${res.status})`);
      const code = (responseBody.error as { code?: number } | undefined)?.code;
      if (res.status === 401 || code === 190 || metaError.toLowerCase().includes('access token')) {
        throw new InternalServerErrorException(
          `[WhatsApp Meta] Token expirado o inválido. Genera uno nuevo en Meta Developers y actualiza WHATSAPP_ACCESS_TOKEN en backend/.env. Detalle: ${metaError}`,
        );
      }
      throw new InternalServerErrorException(`[WhatsApp Meta] ${metaError}`);
    }
  }

  async sendTextMessage(phone: string, text: string): Promise<void> {
    await this.postMessage({
      messaging_product: 'whatsapp',
      to: this.normalizeTo(phone),
      type: 'text',
      text: { body: text },
    });
  }

  async sendTemplateMessage(
    phone: string,
    templateName: string,
    languageCode: string,
  ): Promise<void> {
    await this.postMessage({
      messaging_product: 'whatsapp',
      to: this.normalizeTo(phone),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    });
  }

  async sendWelcomeMessage(phone: string): Promise<void> {
    if (this.welcomeTemplate) {
      await this.sendTemplateMessage(
        phone,
        this.welcomeTemplate,
        this.welcomeTemplateLang,
      );
      return;
    }
    await this.sendTextMessage(phone, WELCOME_MESSAGE);
  }
}
