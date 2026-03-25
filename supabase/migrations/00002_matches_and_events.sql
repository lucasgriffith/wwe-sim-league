-- Matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES tiers(id),
  round_number INTEGER,
  match_phase match_phase NOT NULL,
  pool pool_label,
  wrestler_a_id UUID REFERENCES wrestlers(id),
  wrestler_b_id UUID REFERENCES wrestlers(id),
  tag_team_a_id UUID REFERENCES tag_teams(id),
  tag_team_b_id UUID REFERENCES tag_teams(id),
  winner_wrestler_id UUID REFERENCES wrestlers(id),
  winner_tag_team_id UUID REFERENCES tag_teams(id),
  match_time_seconds INTEGER,
  stipulation TEXT,
  notes TEXT,
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT has_participants CHECK (
    (wrestler_a_id IS NOT NULL AND wrestler_b_id IS NOT NULL AND tag_team_a_id IS NULL AND tag_team_b_id IS NULL)
    OR
    (tag_team_a_id IS NOT NULL AND tag_team_b_id IS NOT NULL AND wrestler_a_id IS NULL AND wrestler_b_id IS NULL)
  )
);

CREATE INDEX idx_matches_season ON matches(season_id);
CREATE INDEX idx_matches_tier ON matches(tier_id);
CREATE INDEX idx_matches_season_tier ON matches(season_id, tier_id);
CREATE INDEX idx_matches_phase ON matches(match_phase);
CREATE INDEX idx_matches_wrestler_a ON matches(wrestler_a_id);
CREATE INDEX idx_matches_wrestler_b ON matches(wrestler_b_id);

-- Relegation Events
CREATE TABLE relegation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES tiers(id),
  wrestler_id UUID REFERENCES wrestlers(id),
  tag_team_id UUID REFERENCES tag_teams(id),
  movement_type movement_type NOT NULL,
  from_tier_id UUID REFERENCES tiers(id),
  to_tier_id UUID REFERENCES tiers(id),
  match_id UUID REFERENCES matches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_relegation_season ON relegation_events(season_id);
