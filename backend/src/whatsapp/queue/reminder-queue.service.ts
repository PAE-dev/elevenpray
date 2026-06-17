import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { Repository } from 'typeorm';
import type { WhatsAppConfig } from '../config/whatsapp.config';
import { Reminder } from '../../study-university/entities/reminder.entity';
import { User } from '../../users/entities/user.entity';
import { WhatsAppMetaClient } from '../whatsapp-meta.client';

export const REMINDER_QUEUE = 'whatsapp-reminders';
export const REMINDER_DLQ = 'whatsapp-reminders-dlq';

export interface ReminderJobPayload {
  reminderId: string;
  userId: string;
}

@Injectable()
export class ReminderQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderQueueService.name);
  private connectionOpts: ConnectionOptions | null = null;
  private queue: Queue<ReminderJobPayload> | null = null;
  private worker: Worker<ReminderJobPayload> | null = null;
  private dlq: Queue<ReminderJobPayload> | null = null;
  private readonly runWorker: boolean;

  constructor(
    config: ConfigService,
    @InjectRepository(Reminder)
    private readonly reminderRepo: Repository<Reminder>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly metaClient: WhatsAppMetaClient,
  ) {
    const wa = config.get<WhatsAppConfig>('whatsapp');
    this.runWorker = wa?.enableReminderWorker ?? false;
  }

  onModuleInit(): void {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('REDIS_URL no configurado — cola de recordatorios deshabilitada');
      return;
    }

    this.connectionOpts = {
      url: redisUrl,
      maxRetriesPerRequest: null,
    };

    this.queue = new Queue<ReminderJobPayload>(REMINDER_QUEUE, {
      connection: this.connectionOpts,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    });
    this.dlq = new Queue<ReminderJobPayload>(REMINDER_DLQ, {
      connection: this.connectionOpts,
    });

    if (this.runWorker) {
      this.worker = new Worker<ReminderJobPayload>(
        REMINDER_QUEUE,
        async (job) => this.processDelivery(job.data),
        {
          connection: this.connectionOpts,
          concurrency: 5,
        },
      );
      this.worker.on('failed', async (job, err) => {
        if (!job) return;
        await this.reminderRepo.update(
          { id: job.data.reminderId },
          {
            attemptCount: job.attemptsMade,
            lastError: err.message,
            deliveryStatus: job.attemptsMade >= (job.opts.attempts ?? 5) ? 'failed' : 'pending',
          },
        );
        if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
          this.logger.error(`Job ${job.id} a DLQ: ${err.message}`);
          await this.dlq?.add('dead', job.data, { removeOnFail: false });
        }
      });
      this.logger.log('Worker de recordatorios WhatsApp iniciado');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.dlq?.close();
  }

  async scheduleDelivery(
    reminderId: string,
    userId: string,
    remindAtRaw: string,
  ): Promise<void> {
    if (!this.queue) {
      this.logger.debug('Cola no disponible — recordatorio solo en BD');
      return;
    }

    const remindAt = new Date(remindAtRaw);
    const delay = Math.max(0, remindAt.getTime() - Date.now());
    const opts: JobsOptions = {
      jobId: reminderId,
      delay,
    };

    await this.queue.add('deliver', { reminderId, userId }, opts);
    this.logger.log(`Recordatorio ${reminderId} encolado (delay=${delay}ms)`);
  }

  private async processDelivery(payload: ReminderJobPayload): Promise<void> {
    const reminder = await this.reminderRepo.findOne({
      where: { id: payload.reminderId },
    });
    if (!reminder || reminder.done || reminder.sentAt) {
      return;
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.userId } });
    if (!user?.whatsappPhone) {
      throw new Error('Usuario sin WhatsApp conectado');
    }

    const text = reminder.note
      ? `⏰ Recordatorio: ${reminder.title}\n${reminder.note}`
      : `⏰ Recordatorio: ${reminder.title}`;

    const phone = user.whatsappPhone.replace(/\D/g, '');
    await this.metaClient.sendTextMessage(phone, text);

    reminder.sentAt = new Date();
    reminder.deliveryStatus = 'sent';
    reminder.done = true;
    await this.reminderRepo.save(reminder);
  }
}
