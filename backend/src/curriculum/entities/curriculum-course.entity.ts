import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { UniversityCourseColorToken } from '../../study-university/study-university.types';

export type CurriculumCourseStatus = 'pending' | 'in_progress' | 'approved' | 'failed';

@Entity('curriculum_courses')
export class CurriculumCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  code: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  credits: string;

  @Column({ name: 'cycle_number', type: 'int', default: 1 })
  cycleNumber: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'approved', 'failed'],
    enumName: 'curriculum_course_status',
    default: 'pending',
  })
  status: CurriculumCourseStatus;

  @Column({
    name: 'color_token',
    type: 'enum',
    enum: ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'indigo', 'teal'],
    enumName: 'university_course_color_token',
    default: 'violet',
  })
  colorToken: UniversityCourseColorToken;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approved_grade', type: 'text', nullable: true })
  approvedGrade: string | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
