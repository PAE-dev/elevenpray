ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS users_whatsapp_phone_unique
  ON users (whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;
