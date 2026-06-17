/**
 * Entrypoint opcional para worker dedicado de recordatorios.
 * Uso: WHATSAPP_ENABLE_REMINDER_WORKER=true REDIS_URL=... node dist/whatsapp/queue/worker-main.js
 */
import { NestFactory } from '@nestjs/core';
import { WhatsAppWorkerModule } from './whatsapp-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WhatsAppWorkerModule);
  const shutdown = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // eslint-disable-next-line no-console
  console.log('WhatsApp reminder worker running');
}

bootstrap();
