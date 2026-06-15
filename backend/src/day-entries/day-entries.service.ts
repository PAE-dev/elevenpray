import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateDayEntryDto } from './dto/create-day-entry.dto';
import { DayEntriesQueryDto } from './dto/day-entries-query.dto';
import { DayEntry, DayEntryType } from './entities/day-entry.entity';

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

export interface DayEntryDto {
  id: string;
  entryDate: string;
  entryType: DayEntryType;
  payload: Record<string, unknown>;
  occurredAt: string;
}

@Injectable()
export class DayEntriesService {
  constructor(
    @InjectRepository(DayEntry)
    private readonly repo: Repository<DayEntry>,
  ) {}

  async create(userId: string, dto: CreateDayEntryDto): Promise<DayEntryDto> {
    const now = new Date();
    const row = this.repo.create({
      userId,
      entryDate: dto.entryDate ?? toYmd(now),
      entryType: dto.entryType,
      payload: dto.payload ?? {},
      occurredAt: now,
    });
    const saved = await this.repo.save(row);
    return this.toDto(saved);
  }

  /** Un solo check-in por día: actualiza el existente o crea uno nuevo. */
  async upsertCheckinForDate(
    userId: string,
    entryDate: string,
    payload: Record<string, unknown>,
  ): Promise<DayEntryDto> {
    const existing = await this.repo.find({
      where: { userId, entryDate, entryType: 'checkin' },
      order: { occurredAt: 'ASC', createdAt: 'ASC' },
    });

    if (existing.length > 0) {
      const primary = existing[0];
      primary.payload = payload;
      const saved = await this.repo.save(primary);

      if (existing.length > 1) {
        const duplicateIds = existing.slice(1).map((row) => row.id);
        await this.repo.delete({ userId, id: In(duplicateIds) });
      }

      return this.toDto(saved);
    }

    return this.create(userId, {
      entryType: 'checkin',
      entryDate,
      payload,
    });
  }

  async listByDate(userId: string, query: DayEntriesQueryDto): Promise<DayEntryDto[]> {
    const targetDate = query.date ?? toYmd(new Date());
    const rows = await this.repo.find({
      where: { userId, entryDate: targetDate },
      order: { occurredAt: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async listDatesWithEntries(userId: string, query: DayEntriesQueryDto): Promise<string[]> {
    const todayYmd = toYmd(new Date());
    const from = query.from ?? addDaysYmd(todayYmd, -69);
    const to = query.to ?? todayYmd;

    const rows = await this.repo
      .createQueryBuilder('e')
      .select('DISTINCT e.entry_date', 'entryDate')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.entry_date >= :from', { from })
      .andWhere('e.entry_date <= :to', { to })
      .orderBy('e.entry_date', 'DESC')
      .getRawMany<{ entryDate: string }>();

    return rows.map((r) => r.entryDate);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }

  private toDto(row: DayEntry): DayEntryDto {
    return {
      id: row.id,
      entryDate: row.entryDate,
      entryType: row.entryType,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      occurredAt: row.occurredAt.toISOString(),
    };
  }
}
