-- Playoff advancement support.
--
-- Brackets are created with TBD slots (e.g. "Seed 1 vs winner of QF2"), so
-- playoff-phase matches must be allowed to have open participant slots.
-- bracket_key identifies each match's position (QF1, QF2, SF1, SF2, Final);
-- advances_to records where the winner goes ("SF2:B" = SF2's B slot), so
-- recording a result can push the winner into the next round.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_key TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS advances_to TEXT;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS has_participants;
ALTER TABLE matches ADD CONSTRAINT has_participants CHECK (
  -- Never mix singles and tag participants on one match
  NOT (
    (wrestler_a_id IS NOT NULL OR wrestler_b_id IS NOT NULL)
    AND (tag_team_a_id IS NOT NULL OR tag_team_b_id IS NOT NULL)
  )
  AND (
    -- Playoff rounds may have TBD slots awaiting earlier results
    match_phase IN ('quarterfinal', 'semifinal', 'final')
    OR (wrestler_a_id IS NOT NULL AND wrestler_b_id IS NOT NULL)
    OR (tag_team_a_id IS NOT NULL AND tag_team_b_id IS NOT NULL)
  )
);
