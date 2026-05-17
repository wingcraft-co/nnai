-- Drop mobile-only tables removed from the backend API surface.
-- Run only against the Railway develop database after taking a pg_dump backup.

DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;

DROP TABLE IF EXISTS circle_members CASCADE;
DROP TABLE IF EXISTS circles CASCADE;

DROP TABLE IF EXISTS move_checklist_items CASCADE;
DROP TABLE IF EXISTS move_plans CASCADE;

DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS city_stays CASCADE;

DROP TABLE IF EXISTS wanderer_hops CASCADE;
DROP TABLE IF EXISTS planner_tasks CASCADE;
DROP TABLE IF EXISTS planner_boards CASCADE;
DROP TABLE IF EXISTS free_spirit_spins CASCADE;
DROP TABLE IF EXISTS local_saved_events CASCADE;
DROP TABLE IF EXISTS pioneer_milestones CASCADE;
