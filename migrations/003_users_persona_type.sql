-- Persist nnai standard persona_type on users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS persona_type TEXT;
