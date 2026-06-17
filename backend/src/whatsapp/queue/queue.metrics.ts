import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from '../../study-university/entities/reminder.entity';

@Injectable()
export class ReminderQueueMetricsService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepo: Repository<Reminder>,
  ) {}

  async getPendingCount(): Promise<number> {
    return this.reminderRepo.count({
      where: { done: false, deliveryStatus: 'pending' },
    });
  }

  async getFailedCount(): Promise<number> {
    return this.reminderRepo.count({
      where: { deliveryStatus: 'failed' },
    });
  }
}
