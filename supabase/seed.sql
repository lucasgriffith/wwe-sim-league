-- Seed divisions
INSERT INTO divisions (name, gender, division_type, display_order) VALUES
  ('Men''s Singles', 'male', 'singles', 1),
  ('Women''s Singles', 'female', 'singles', 2),
  ('Men''s Tag Teams', 'male', 'tag', 3),
  ('Women''s Tag Teams', 'female', 'tag', 4);

-- Seed Men's Singles tiers (16 tiers)
INSERT INTO tiers (division_id, tier_number, name, short_name, color, pool_size, has_pools, fixed_stipulation)
SELECT d.id, t.tier_number, t.name, t.short_name, t.color, t.pool_size, true, t.fixed_stipulation
FROM divisions d
CROSS JOIN (VALUES
  (1,  'Undisputed WWE Championship',         'WWE',   '#FFD700', 12, NULL),
  (2,  'World Heavyweight Championship',       'WHC',   '#C0C0C0', 12, NULL),
  (3,  'WCW World Heavyweight Championship',   'WCW',   '#CD7F32', 10, NULL),
  (4,  'ECW World Heavyweight Championship',   'ECW',   '#8B4513', 10, NULL),
  (5,  'NXT Championship',                     'NXT',   '#FFD700', 10, NULL),
  (6,  'WWE Intercontinental Championship',    'IC',    '#FFFFFF', 10, NULL),
  (7,  'WWE Crown Jewel Championship',         'CJ',    '#9B59B6', 10, NULL),
  (8,  'AAA Mega Championship',                'AAA',   '#E74C3C', 8,  NULL),
  (9,  'NXT North American Championship',      'NA',    '#3498DB', 8,  NULL),
  (10, 'WWE United States Championship',       'US',    '#E74C3C', 8,  NULL),
  (11, 'Million Dollar Championship',          'MDC',   '#2ECC71', 8,  NULL),
  (12, 'WWE European Championship',            'EUR',   '#1ABC9C', 8,  NULL),
  (13, 'NXT United Kingdom Championship',      'UK',    '#9B59B6', 8,  NULL),
  (14, 'ECW World Television Championship',    'TV',    '#F39C12', 8,  NULL),
  (15, 'NXT Cruiserweight Championship',       'CW',    '#3498DB', 8,  NULL),
  (16, 'WWE Hardcore Championship',            'HC',    '#C0392B', 8,  'Falls Count Anywhere')
) AS t(tier_number, name, short_name, color, pool_size, fixed_stipulation)
WHERE d.name = 'Men''s Singles';

-- Seed Women's Singles tiers (7 tiers)
INSERT INTO tiers (division_id, tier_number, name, short_name, color, pool_size, has_pools)
SELECT d.id, t.tier_number, t.name, t.short_name, t.color, t.pool_size, true
FROM divisions d
CROSS JOIN (VALUES
  (1, 'WWE Women''s Championship',                    'WWC',  '#FFD700', 10),
  (2, 'WWE Women''s World Championship',              'WWWC', '#C0C0C0', 10),
  (3, 'NXT Women''s Championship',                    'NXTW', '#CD7F32', 8),
  (4, 'WWE Women''s Intercontinental Championship',   'WIC',  '#FFFFFF', 8),
  (5, 'NXT Women''s North American Championship',     'WNA',  '#3498DB', 8),
  (6, 'WWE Women''s United States Championship',      'WUS',  '#E74C3C', 8),
  (7, 'NXT UK Women''s Championship',                 'WUK',  '#9B59B6', 8)
) AS t(tier_number, name, short_name, color, pool_size)
WHERE d.name = 'Women''s Singles';

-- Seed Men's Tag tiers (3 tiers)
INSERT INTO tiers (division_id, tier_number, name, short_name, color, pool_size, has_pools)
SELECT d.id, t.tier_number, t.name, t.short_name, t.color, t.pool_size, false
FROM divisions d
CROSS JOIN (VALUES
  (1, 'WWE Tag Team / World Tag Team Championship',   'TAG1', '#FFD700', 12),
  (2, 'NXT Tag Team Championship',                    'TAG2', '#C0C0C0', 10),
  (3, 'WCW / ECW Tag Team Championship',              'TAG3', '#CD7F32', 10)
) AS t(tier_number, name, short_name, color, pool_size)
WHERE d.name = 'Men''s Tag Teams';

-- Seed Women's Tag tiers (2 tiers)
INSERT INTO tiers (division_id, tier_number, name, short_name, color, pool_size, has_pools)
SELECT d.id, t.tier_number, t.name, t.short_name, t.color, t.pool_size, false
FROM divisions d
CROSS JOIN (VALUES
  (1, 'WWE Women''s Tag Team Championship',           'WTAG1', '#FFD700', 10),
  (2, 'NXT Women''s Tag Team Championship',            'WTAG2', '#C0C0C0', 8)
) AS t(tier_number, name, short_name, color, pool_size)
WHERE d.name = 'Women''s Tag Teams';
