import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import whatsappConfig from '../config/whatsapp.config';
import { Reminder } from '../../study-university/entities/reminder.entity';
import { User } from '../../users/entities/user.entity';
import { WhatsAppMetaClient } from '../whatsapp-meta.client';
import { ReminderQueueService } from './reminder-queue.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [whatsappConfig] }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ...(process.env.DATABASE_URL?.includes('supabase.co')
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
      autoLoadEntities: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Reminder, User]),
  ],
  providers: [WhatsAppMetaClient, ReminderQueueService],
})
export class WhatsAppWorkerModule {}
