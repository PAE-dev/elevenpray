-- Sesión conversacional y estado de flujo explícito para routing LLM-first
ALTER TABLE whatsapp_conversation_state
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS session_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_flow text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_classification jsonb;
