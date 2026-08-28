ALTER TABLE opportunities ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

ALTER TABLE opportunity_items ADD COLUMN reference TEXT;
ALTER TABLE opportunity_items ADD COLUMN manufacturer TEXT;
ALTER TABLE opportunity_items ADD COLUMN delivery_deadline TEXT;
ALTER TABLE opportunity_items ADD COLUMN technical_notes TEXT;
ALTER TABLE opportunity_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_opportunities_active_number
  ON opportunities(lower(trim(number)))
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_items_archived_at
  ON opportunity_items(archived_at);
