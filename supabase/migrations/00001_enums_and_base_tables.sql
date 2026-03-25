-- Enums
CREATE TYPE gender AS ENUM ('male', 'female');
CREATE TYPE division_type AS ENUM ('singles', 'tag');
CREATE TYPE pool_label AS ENUM ('A', 'B');
CREATE TYPE season_status AS ENUM ('setup', 'pool_play', 'playoffs', 'relegation', 'completed');
CREATE TYPE match_phase AS ENUM ('pool_play', 'quarterfinal', 'semifinal', 'final', 'relegation');
CREATE TYPE movement_type AS ENUM ('auto_promote', 'auto_relegate', 'playoff_promote', 'playoff_relegate', 'playoff_survive');

-- Wrestlers
CREATE TABLE wrestlers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  gender gender NOT NULL,
  brand TEXT,
  overall_rating INTEGER,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Divisions
CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  gender gender NOT NULL,
  division_type division_type NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Tiers
CREATE TABLE tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES divisions(id),
  tier_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  color TEXT,
  pool_size INTEGER NOT NULL DEFAULT 8,
  has_pools BOOLEAN NOT NULL DEFAULT true,
  fixed_stipulation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division_id, tier_number)
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number INTEGER NOT NULL UNIQUE,
  status season_status NOT NULL DEFAULT 'setup',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tag Teams
CREATE TABLE tag_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wrestler_a_id UUID NOT NULL REFERENCES wrestlers(id),
  wrestler_b_id UUID NOT NULL REFERENCES wrestlers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT different_members CHECK (wrestler_a_id <> wrestler_b_id)
);

-- Tier Assignments
CREATE TABLE tier_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES tiers(id),
  wrestler_id UUID REFERENCES wrestlers(id),
  tag_team_id UUID REFERENCES tag_teams(id),
  pool pool_label,
  seed INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_participant CHECK (
    (wrestler_id IS NOT NULL AND tag_team_id IS NULL) OR
    (wrestler_id IS NULL AND tag_team_id IS NOT NULL)
  )
);

CREATE INDEX idx_tier_assignments_season ON tier_assignments(season_id);
CREATE INDEX idx_tier_assignments_tier ON tier_assignments(tier_id);
CREATE INDEX idx_tier_assignments_season_tier ON tier_assignments(season_id, tier_id);
