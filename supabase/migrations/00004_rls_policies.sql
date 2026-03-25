-- Enable RLS on all tables
ALTER TABLE wrestlers ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE relegation_events ENABLE ROW LEVEL SECURITY;

-- Public read for all tables
CREATE POLICY "Public read wrestlers" ON wrestlers FOR SELECT USING (true);
CREATE POLICY "Public read divisions" ON divisions FOR SELECT USING (true);
CREATE POLICY "Public read tiers" ON tiers FOR SELECT USING (true);
CREATE POLICY "Public read seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public read tag_teams" ON tag_teams FOR SELECT USING (true);
CREATE POLICY "Public read tier_assignments" ON tier_assignments FOR SELECT USING (true);
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read relegation_events" ON relegation_events FOR SELECT USING (true);

-- All writes go through the service_role key (admin client), which bypasses RLS.
-- No INSERT/UPDATE/DELETE policies needed for anon/authenticated roles.
