-- Function: advance season status with validation
CREATE OR REPLACE FUNCTION advance_season_status(
  p_season_id UUID,
  p_new_status season_status
) RETURNS void AS $$
DECLARE
  v_current season_status;
BEGIN
  SELECT status INTO v_current FROM seasons WHERE id = p_season_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Season not found: %', p_season_id;
  END IF;

  IF NOT (
    (v_current = 'setup' AND p_new_status = 'pool_play') OR
    (v_current = 'pool_play' AND p_new_status = 'playoffs') OR
    (v_current = 'playoffs' AND p_new_status = 'relegation') OR
    (v_current = 'relegation' AND p_new_status = 'completed')
  ) THEN
    RAISE EXCEPTION 'Invalid season transition from % to %', v_current, p_new_status;
  END IF;

  UPDATE seasons SET
    status = p_new_status,
    started_at = CASE WHEN p_new_status = 'pool_play' AND started_at IS NULL THEN now() ELSE started_at END,
    completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_season_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
