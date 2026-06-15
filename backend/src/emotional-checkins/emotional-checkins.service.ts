import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmotionalCheckIn, EmotionalMoodId } from './entities/emotional-check-in.entity';
import { UpsertTodayCheckInDto } from './dto/upsert-today-check-in.dto';
import { StudentActivityService } from '../student-activity/student-activity.service';
import { UserDailyActivity } from '../student-activity/entities/user-daily-activity.entity';
import { DayEntriesService } from '../day-entries/day-entries.service';

export interface EmotionalCheckInDto {
  mood: EmotionalMoodId;
  factors: string[];
  note: string | null;
  checkInDate: string;
}

export interface EmotionalHistoryEntry {
  checkInDate: string;
  mood: EmotionalMoodId;
  factors: string[];
}

export interface EmotionalSummaryResponse {
  streak: number;
  week: (EmotionalMoodId | null)[];
  insights: string[];
}

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

function computeStreak(dates: Set<string>, todayYmd: string): number {
  let cursor = todayYmd;
  if (!dates.has(cursor)) {
    cursor = addDaysYmd(todayYmd, -1);
  }
  let count = 0;
  while (dates.has(cursor)) {
    count++;
    cursor = addDaysYmd(cursor, -1);
  }
  return count;
}

function buildWeekMoods(
  byDate: Map<string, EmotionalMoodId>,
  todayYmd: string,
): (EmotionalMoodId | null)[] {
  const week: (EmotionalMoodId | null)[] = [];
  for (let i = 6; i >= 0; i--) {
    const ymd = addDaysYmd(todayYmd, -i);
    week.push(byDate.get(ymd) ?? null);
  }
  return week;
}

function computeInsights(
  rows: EmotionalCheckIn[],
  studyDates: Set<string>,
): string[] {
  const insights: string[] = [];
  const lowMoods: EmotionalMoodId[] = ['bad', 'low'];
  const goodMoods: EmotionalMoodId[] = ['good', 'excellent'];

  const lowWithSleepBad = rows.filter(
    (r) =>
      lowMoods.includes(r.mood) &&
      Array.isArray(r.factors) &&
      r.factors.includes('sleepBad'),
  ).length;

  if (lowWithSleepBad >= 3) {
    insights.push(
      "Tus días 'mal' coinciden con poco sueño. Prioriza descansar esta semana.",
    );
  }

  const goodDays = rows.filter((r) => goodMoods.includes(r.mood));
  const goodWithStudy = goodDays.filter((r) => studyDates.has(r.checkInDate)).length;
  if (goodDays.length >= 3 && goodWithStudy >= Math.ceil(goodDays.length * 0.6)) {
    insights.push('Estudias mejor los días que te sientes bien.');
  }

  if (insights.length === 0 && rows.length >= 7) {
    insights.push('Llevas registrando tu ánimo con constancia. Eso ya es cuidarte.');
  }

  return insights.slice(0, 2);
}

@Injectable()
export class EmotionalCheckinsService {
  constructor(
    @InjectRepository(EmotionalCheckIn)
    private readonly repo: Repository<EmotionalCheckIn>,
    @InjectRepository(UserDailyActivity)
    private readonly activityRepo: Repository<UserDailyActivity>,
    private readonly studentActivity: StudentActivityService,
    private readonly dayEntries: DayEntriesService,
  ) {}

  async upsertToday(userId: string, dto: UpsertTodayCheckInDto): Promise<EmotionalCheckInDto> {
    const checkInDate = toYmd(new Date());
    let row = await this.repo.findOne({ where: { userId, checkInDate } });
    const factors = dto.factors ?? [];
    const note = dto.note?.trim() || null;

    if (!row) {
      row = this.repo.create({
        userId,
        checkInDate,
        mood: dto.mood,
        factors,
        note,
      });
    } else {
      row.mood = dto.mood;
      row.factors = factors;
      row.note = note;
    }

    const saved = await this.repo.save(row);
    await this.studentActivity.record(userId, { type: 'checkin' });
    await this.dayEntries.upsertCheckinForDate(userId, checkInDate, {
      mood: saved.mood,
      factors: Array.isArray(saved.factors) ? saved.factors : [],
      note: saved.note,
    });

    return this.toDto(saved);
  }

  async getToday(userId: string): Promise<EmotionalCheckInDto | null> {
    const checkInDate = toYmd(new Date());
    const row = await this.repo.findOne({ where: { userId, checkInDate } });
    return row ? this.toDto(row) : null;
  }

  async getHistory(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<EmotionalHistoryEntry[]> {
    const todayYmd = toYmd(new Date());
    const toDate = to ?? todayYmd;
    const fromDate = from ?? addDaysYmd(todayYmd, -69);

    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.check_in_date >= :from', { from: fromDate })
      .andWhere('c.check_in_date <= :to', { to: toDate })
      .orderBy('c.check_in_date', 'ASC')
      .getMany();

    return rows.map((r) => ({
      checkInDate: r.checkInDate,
      mood: r.mood,
      factors: Array.isArray(r.factors) ? r.factors : [],
    }));
  }

  async getSummary(userId: string): Promise<EmotionalSummaryResponse> {
    const todayYmd = toYmd(new Date());
    const lookbackStart = addDaysYmd(todayYmd, -120);

    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.check_in_date >= :from', { from: lookbackStart })
      .orderBy('c.check_in_date', 'ASC')
      .getMany();

    const dateSet = new Set(rows.map((r) => r.checkInDate));
    const streak = computeStreak(dateSet, todayYmd);

    const byDate = new Map<string, EmotionalMoodId>();
    for (const r of rows) {
      byDate.set(r.checkInDate, r.mood);
    }
    const week = buildWeekMoods(byDate, todayYmd);

    const activityRows = await this.activityRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.activity_date >= :from', { from: addDaysYmd(todayYmd, -30) })
      .andWhere('a.study = true')
      .getMany();
    const studyDates = new Set(activityRows.map((a) => a.activityDate));
    const recentRows = rows.filter((r) => r.checkInDate >= addDaysYmd(todayYmd, -30));
    const insights = computeInsights(recentRows, studyDates);

    if (streak > 0 && insights.length < 2) {
      const streakInsight = `Llevas ${streak} días registrando tu ánimo. Eso ya es cuidarte.`;
      if (!insights.some((i) => i.includes('registrando'))) {
        insights.unshift(streakInsight);
      }
    }

    return {
      streak,
      week,
      insights: insights.slice(0, 2),
    };
  }

  private toDto(row: EmotionalCheckIn): EmotionalCheckInDto {
    return {
      mood: row.mood,
      factors: Array.isArray(row.factors) ? row.factors : [],
      note: row.note,
      checkInDate: row.checkInDate,
    };
  }
}
