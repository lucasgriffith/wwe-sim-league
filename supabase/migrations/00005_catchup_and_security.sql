-- Catch-up migration: columns added via the dashboard that were never
-- captured in version control, missing indexes, and security hardening.
-- Safe to run against the live database (IF NOT EXISTS guards throughout).

-- ─── Columns that exist in production but not in migrations ─────────────────

ALTER TABLE wrestlers ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS belt_image_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wrestlers_slug ON wrestlers(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tiers_slug ON tiers(slug) WHERE slug IS NOT NULL;

-- ─── Missing indexes implied by query patterns ──────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tier_assignments_wrestler ON tier_assignments(wrestler_id);
CREATE INDEX IF NOT EXISTS idx_tier_assignments_tag_team ON tier_assignments(tag_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_tag_team_a ON matches(tag_team_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_tag_team_b ON matches(tag_team_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_season_played ON matches(season_id, played_at);

-- ─── Prevent duplicate tier assignments ─────────────────────────────────────
-- NOTE: fails if duplicate rows already exist; clean them up first if so.

CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_assignments_unique_wrestler
  ON tier_assignments(season_id, wrestler_id) WHERE wrestler_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_assignments_unique_tag_team
  ON tier_assignments(season_id, tag_team_id) WHERE tag_team_id IS NOT NULL;

-- ─── Security: advance_season_status is SECURITY DEFINER ────────────────────
-- Without this, PostgREST exposes it to anonymous callers who can mutate
-- season state with just the public anon key.

REVOKE EXECUTE ON FUNCTION advance_season_status(UUID, season_status) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION advance_season_status(UUID, season_status) FROM anon;
REVOKE EXECUTE ON FUNCTION advance_season_status(UUID, season_status) FROM authenticated;
