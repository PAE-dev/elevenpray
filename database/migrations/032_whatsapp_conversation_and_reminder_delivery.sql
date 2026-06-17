-- Estado conversacional WhatsApp (slots, confirmación, historial corto)
CREATE TABLE IF NOT EXISTS whatsapp_conversation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  pending_intent TEXT,
  pending_tool TEXT,
  pending_slots JSONB NOT NULL DEFAULT '{}',
  awaiting_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  last_tool_result JSONB,
  recent_turns JSONB NOT NULL DEFAULT '[]',
  conversation_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversation_user
  ON whatsapp_conversation_state(user_id);

-- Campos de entrega para recordatorios proactivos
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reminders_pending_delivery
  ON reminders(remind_at)
  WHERE done = FALSE AND sent_at IS NULL;
