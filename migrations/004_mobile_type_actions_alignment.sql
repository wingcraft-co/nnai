-- Align mobile type-actions schema with nnai-mobile current API contracts

ALTER TABLE city_stays
ALTER COLUMN country DROP NOT NULL;

ALTER TABLE wanderer_hops
ADD COLUMN IF NOT EXISTS from_country TEXT;
ALTER TABLE wanderer_hops
ADD COLUMN IF NOT EXISTS to_country TEXT;
ALTER TABLE wanderer_hops
ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE wanderer_hops
ADD COLUMN IF NOT EXISTS target_month TEXT;

ALTER TABLE planner_boards
ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE planner_boards
ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE planner_tasks
ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE planner_tasks
ADD COLUMN IF NOT EXISTS due_date TEXT;
ALTER TABLE planner_tasks
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE planner_tasks SET text = title WHERE text IS NULL;

ALTER TABLE free_spirit_spins
ADD COLUMN IF NOT EXISTS selected JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE free_spirit_spins
ADD COLUMN IF NOT EXISTS candidates_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS source_event_id TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS starts_at TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS ends_at TEXT;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE local_saved_events
ADD COLUMN IF NOT EXISTS radius_m INTEGER NOT NULL DEFAULT 1500;

UPDATE local_saved_events
SET source_event_id = event_id
WHERE source_event_id IS NULL;

UPDATE local_saved_events
SET source = 'google_places'
WHERE source IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_local_saved_events_user_source_event
ON local_saved_events (user_id, source, source_event_id);

ALTER TABLE pioneer_milestones
ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE pioneer_milestones
ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE pioneer_milestones
ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE pioneer_milestones
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo';
ALTER TABLE pioneer_milestones
ADD COLUMN IF NOT EXISTS target_date TEXT;
ALTER TABLE pioneer_milestones
ADD COLUMN IF NOT EXISTS note TEXT;

UPDATE pioneer_milestones
SET status = CASE WHEN is_done THEN 'done' ELSE 'todo' END
WHERE status IS NULL;
