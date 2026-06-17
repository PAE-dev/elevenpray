import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('whatsapp_conversation_state')
@Index(['userId'], { unique: true })
export class WhatsAppConversationState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'thread_id', type: 'text' })
  threadId: string;

  @Column({ name: 'pending_intent', type: 'text', nullable: true })
  pendingIntent: string | null;

  @Column({ name: 'pending_tool', type: 'text', nullable: true })
  pendingTool: string | null;

  @Column({ name: 'pending_slots', type: 'jsonb', default: {} })
  pendingSlots: Record<string, unknown>;

  @Column({ name: 'awaiting_confirmation', type: 'boolean', default: false })
  awaitingConfirmation: boolean;

  @Column({ name: 'awaiting_slot', type: 'text', nullable: true })
  awaitingSlot: string | null;

  @Column({ name: 'last_tool_result', type: 'jsonb', nullable: true })
  lastToolResult: unknown;

  @Column({ name: 'recent_turns', type: 'jsonb', default: [] })
  recentTurns: Array<{ role: 'user' | 'assistant'; content: string; at: string }>;

  @Column({ name: 'conversation_summary', type: 'text', nullable: true })
  conversationSummary: string | null;

  @Column({ name: 'session_id', type: 'text', nullable: true })
  sessionId: string | null;

  @Column({ name: 'session_started_at', type: 'timestamptz', nullable: true })
  sessionStartedAt: Date | null;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'active_flow', type: 'text', default: 'none' })
  activeFlow: string;

  @Column({ name: 'last_classification', type: 'jsonb', nullable: true })
  lastClassification: {
    intent: string;
    confidence: number;
    reasoning: string;
  } | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
