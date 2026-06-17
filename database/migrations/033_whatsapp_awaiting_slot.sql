-- Slot activo en flujos multi-turno (crear/editar tarea)
ALTER TABLE whatsapp_conversation_state
  ADD COLUMN IF NOT EXISTS awaiting_slot TEXT;
