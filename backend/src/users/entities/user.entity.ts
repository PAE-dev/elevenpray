import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'text', default: 'user' })
  role: 'user' | 'platform_admin';

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'google_sub', type: 'text', nullable: true })
  googleSub: string | null;

  @Column({ name: 'student_university', type: 'text', nullable: true })
  studentUniversity: string | null;

  @Column({ name: 'student_career', type: 'text', nullable: true })
  studentCareer: string | null;

  @Column({ name: 'student_academic_cycle', type: 'text', nullable: true })
  studentAcademicCycle: string | null;

  @Column({
    name: 'student_onboarding_completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  studentOnboardingCompletedAt: Date | null;

  @Column({ name: 'student_program_type', type: 'text', nullable: true })
  studentProgramType: 'tecnico' | 'universidad' | null;

  @Column({ name: 'curriculum_total_cycles', type: 'smallint', nullable: true })
  curriculumTotalCycles: number | null;

  @Column({
    name: 'student_grade_scale',
    type: 'enum',
    enum: ['0_20', '0_100', 'A_F'],
    enumName: 'university_grade_scale',
    default: '0_20',
  })
  studentGradeScale: '0_20' | '0_100' | 'A_F';

  @Column({ name: 'referred_by_user_id', type: 'uuid', nullable: true })
  referredByUserId: string | null;

  @Column({ name: 'referred_at', type: 'timestamptz', nullable: true })
  referredAt: Date | null;

  @Column({ name: 'whatsapp_phone', type: 'text', nullable: true })
  whatsappPhone: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
