CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  source_platform TEXT NOT NULL DEFAULT 'word',
  external_id TEXT,
  number TEXT NOT NULL,
  title TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Nao analisada',
  import_batch_id TEXT,
  import_file_name TEXT,
  imported_at TEXT,
  archive_reason TEXT,
  raw_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_opportunities_number ON opportunities(number);
CREATE INDEX IF NOT EXISTS idx_opportunities_archived_at ON opportunities(archived_at);

CREATE TABLE IF NOT EXISTS opportunity_items (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  item_number TEXT,
  quantity TEXT,
  unit TEXT,
  delivery_location TEXT,
  attachment_required TEXT,
  quotation_status TEXT,
  description TEXT,
  raw_description TEXT,
  category TEXT,
  standard TEXT,
  dimensions TEXT,
  standardized_attributes TEXT,
  standardized_specifications TEXT,
  standardization_observations TEXT,
  manufacturer_references TEXT,
  codes TEXT,
  manufacturers TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opportunity_items_opportunity_id ON opportunity_items(opportunity_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

CREATE TABLE IF NOT EXISTS supplier_specialties (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  manufacturer TEXT,
  category TEXT,
  notes TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_specialties_supplier_id ON supplier_specialties(supplier_id);

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT,
  opportunity_number TEXT,
  item_id TEXT,
  item_number TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  email TEXT,
  description TEXT,
  item_description TEXT,
  status TEXT NOT NULL DEFAULT 'Cotacao gerada',
  requested_at TEXT,
  email_sent_at TEXT,
  responded_at TEXT,
  unit_price TEXT,
  delivery_days TEXT,
  validity_days TEXT,
  payment_terms TEXT,
  freight TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quotations_opportunity_id ON quotations(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotations_item_id ON quotations(item_id);
CREATE INDEX IF NOT EXISTS idx_quotations_supplier_id ON quotations(supplier_id);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT,
  opportunity_number TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Rascunho',
  margin_percent TEXT,
  total_value TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_proposals_opportunity_id ON proposals(opportunity_id);

CREATE TABLE IF NOT EXISTS proposal_items (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  opportunity_item_id TEXT,
  item_number TEXT,
  description TEXT,
  quantity TEXT,
  unit TEXT,
  delivery_location TEXT,
  quotation_id TEXT,
  supplier_name TEXT,
  cost_unit_price TEXT,
  sale_unit_price TEXT,
  margin_percent TEXT,
  total_sale_price TEXT,
  FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_id ON proposal_items(proposal_id);
