import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..");
const dataDir = join(backendRoot, "data");
const configuredDatabasePath = process.env.LICITA_AI_DB_PATH?.trim();
const databasePath = configuredDatabasePath
  ? resolve(configuredDatabasePath)
  : join(dataDir, "licita-ai.sqlite");
const migrationsDir = join(backendRoot, "db", "migrations");

export function openDatabase(filePath = databasePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec("PRAGMA foreign_keys = ON;");
  return database;
}

export function initializeDatabase(filePath = databasePath) {
  const database = openDatabase(filePath);
  applyMigrations(database);
  return database;
}

function applyMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    database.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version)
  );
  const migrationFiles = readdirSync(migrationsDir)
    .filter((fileName) => /^\d+_.+\.sql$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));

  migrationFiles.forEach((fileName) => {
    if (appliedVersions.has(fileName)) return;

    const sql = readFileSync(join(migrationsDir, fileName), "utf8");
    database.exec("BEGIN TRANSACTION;");
    try {
      database.exec(sql);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(fileName, nowIso());
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw new Error(`Falha ao aplicar migracao ${fileName}: ${error.message}`);
    }
  });
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function valueOrNull(value) {
  return value === undefined || value === null ? null : value;
}

function nowIso() {
  return new Date().toISOString();
}

function runStatement(database, sql, values) {
  database.prepare(sql).run(...values);
}

function clearAllData(database) {
  database.exec(`
    DELETE FROM proposal_items;
    DELETE FROM proposals;
    DELETE FROM quotations;
    DELETE FROM supplier_specialties;
    DELETE FROM suppliers;
    DELETE FROM opportunity_items;
    DELETE FROM opportunities;
  `);
}

function clearOpportunities(database) {
  database.exec(`
    DELETE FROM opportunity_items;
    DELETE FROM opportunities;
  `);
}

function insertOpportunity(database, opportunity) {
  const createdAt = opportunity.createdAt || nowIso();
  const updatedAt = opportunity.updatedAt || createdAt;

  runStatement(
    database,
    `INSERT INTO opportunities (
      id, source_platform, external_id, number, title, due_date, status,
      import_batch_id, import_file_name, imported_at, archive_reason,
      raw_snapshot, created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      opportunity.id,
      opportunity.sourcePlatform || "word",
      valueOrNull(opportunity.externalId),
      opportunity.number || "",
      valueOrNull(opportunity.title),
      valueOrNull(opportunity.dueDate),
      opportunity.status || "Nao analisada",
      valueOrNull(opportunity.importBatchId),
      valueOrNull(opportunity.importFileName),
      valueOrNull(opportunity.importedAt),
      valueOrNull(opportunity.archiveReason),
      stringifyJson(opportunity.rawSnapshot),
      createdAt,
      updatedAt,
      valueOrNull(opportunity.archivedAt),
    ]
  );

  (opportunity.items || []).forEach((item) => insertOpportunityItem(database, opportunity.id, item));
}

function insertOpportunityItem(database, opportunityId, item) {
  const createdAt = item.createdAt || nowIso();
  const updatedAt = item.updatedAt || createdAt;

  runStatement(
    database,
    `INSERT INTO opportunity_items (
      id, opportunity_id, item_number, quantity, unit, delivery_location,
      attachment_required, quotation_status, description, raw_description,
      category, standard, dimensions, standardized_attributes,
      standardized_specifications, standardization_observations,
      manufacturer_references, codes, manufacturers, created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      opportunityId,
      valueOrNull(item.itemNumber),
      valueOrNull(item.quantity),
      valueOrNull(item.unit),
      valueOrNull(item.deliveryLocation),
      valueOrNull(item.attachmentRequired),
      valueOrNull(item.quotationStatus),
      valueOrNull(item.description),
      valueOrNull(item.rawDescription),
      valueOrNull(item.category),
      valueOrNull(item.standard),
      valueOrNull(item.dimensions),
      stringifyJson(item.standardizedAttributes || {}),
      stringifyJson(item.standardizedSpecifications || []),
      stringifyJson(item.standardizationObservations || []),
      stringifyJson(item.manufacturerReferences || []),
      stringifyJson(item.codes || []),
      stringifyJson(item.manufacturers || []),
      createdAt,
      updatedAt,
      valueOrNull(item.archivedAt),
    ]
  );
}

function insertSupplier(database, supplier) {
  const createdAt = supplier.createdAt || nowIso();
  const updatedAt = supplier.updatedAt || createdAt;

  runStatement(
    database,
    `INSERT INTO suppliers (
      id, name, legal_name, tax_id, email, phone, status, notes,
      created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      supplier.id,
      supplier.name || "",
      valueOrNull(supplier.legalName),
      valueOrNull(supplier.taxId),
      valueOrNull(supplier.email),
      valueOrNull(supplier.phone),
      supplier.status || "Ativo",
      valueOrNull(supplier.notes),
      createdAt,
      updatedAt,
      valueOrNull(supplier.archivedAt),
    ]
  );

  (supplier.specialties || []).forEach((specialty) =>
    runStatement(
      database,
      `INSERT INTO supplier_specialties (
        id, supplier_id, manufacturer, category, notes
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        specialty.id,
        supplier.id,
        valueOrNull(specialty.manufacturer),
        valueOrNull(specialty.category),
        valueOrNull(specialty.notes),
      ]
    )
  );
}

export function saveSupplier(database, supplier) {
  if (!supplier || !supplier.id || !supplier.name) {
    throw new Error("Fornecedor invalido.");
  }

  const existing = database.prepare("SELECT created_at FROM suppliers WHERE id = ?").get(supplier.id);
  const createdAt = existing?.created_at || supplier.createdAt || nowIso();
  const updatedAt = nowIso();

  database.exec("BEGIN TRANSACTION;");
  try {
    runStatement(
      database,
      `INSERT INTO suppliers (
        id, name, legal_name, tax_id, email, phone, status, notes,
        created_at, updated_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        legal_name = excluded.legal_name,
        tax_id = excluded.tax_id,
        email = excluded.email,
        phone = excluded.phone,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        archived_at = excluded.archived_at`,
      [
        supplier.id,
        supplier.name,
        valueOrNull(supplier.legalName),
        valueOrNull(supplier.taxId),
        valueOrNull(supplier.email),
        valueOrNull(supplier.phone),
        supplier.status || "Ativo",
        valueOrNull(supplier.notes),
        createdAt,
        updatedAt,
        valueOrNull(supplier.archivedAt),
      ]
    );

    runStatement(database, "DELETE FROM supplier_specialties WHERE supplier_id = ?", [supplier.id]);

    (supplier.specialties || []).forEach((specialty) =>
      runStatement(
        database,
        `INSERT INTO supplier_specialties (
          id, supplier_id, manufacturer, category, notes
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          specialty.id,
          supplier.id,
          valueOrNull(specialty.manufacturer),
          valueOrNull(specialty.category),
          valueOrNull(specialty.notes),
        ]
      )
    );

    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  return listSuppliers(database).find((item) => item.id === supplier.id);
}

export function archiveSupplier(database, id) {
  const existing = database.prepare("SELECT id FROM suppliers WHERE id = ? AND archived_at IS NULL").get(id);
  if (!existing) {
    throw new Error("Fornecedor nao encontrado.");
  }

  const updatedAt = nowIso();
  runStatement(
    database,
    "UPDATE suppliers SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?",
    ["Excluido", updatedAt, updatedAt, id]
  );

  return { id, archivedAt: updatedAt };
}

function insertQuotation(database, quotation) {
  const createdAt = quotation.createdAt || nowIso();
  const updatedAt = quotation.updatedAt || createdAt;

  runStatement(
    database,
    `INSERT INTO quotations (
      id, opportunity_id, opportunity_number, item_id, item_number,
      supplier_id, supplier_name, email, description, item_description,
      status, requested_at, email_sent_at, responded_at, unit_price,
      delivery_days, validity_days, payment_terms, freight, notes,
      created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      quotation.id,
      valueOrNull(quotation.opportunityId),
      valueOrNull(quotation.opportunityNumber),
      valueOrNull(quotation.itemId),
      valueOrNull(quotation.itemNumber),
      valueOrNull(quotation.supplierId),
      valueOrNull(quotation.supplierName),
      valueOrNull(quotation.email),
      valueOrNull(quotation.description),
      valueOrNull(quotation.itemDescription),
      quotation.status || "Cotacao gerada",
      valueOrNull(quotation.requestedAt),
      valueOrNull(quotation.emailSentAt),
      valueOrNull(quotation.respondedAt),
      valueOrNull(quotation.unitPrice),
      valueOrNull(quotation.deliveryDays),
      valueOrNull(quotation.validityDays),
      valueOrNull(quotation.paymentTerms),
      valueOrNull(quotation.freight),
      valueOrNull(quotation.notes),
      createdAt,
      updatedAt,
      valueOrNull(quotation.archivedAt),
    ]
  );
}

export function saveQuotation(database, quotation) {
  if (!quotation || !quotation.id) {
    throw new Error("Cotacao invalida.");
  }

  const existing = database.prepare("SELECT created_at FROM quotations WHERE id = ?").get(quotation.id);
  const createdAt = existing?.created_at || quotation.createdAt || nowIso();
  const updatedAt = nowIso();

  runStatement(
    database,
    `INSERT INTO quotations (
      id, opportunity_id, opportunity_number, item_id, item_number,
      supplier_id, supplier_name, email, description, item_description,
      status, requested_at, email_sent_at, responded_at, unit_price,
      delivery_days, validity_days, payment_terms, freight, notes,
      created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      opportunity_id = excluded.opportunity_id,
      opportunity_number = excluded.opportunity_number,
      item_id = excluded.item_id,
      item_number = excluded.item_number,
      supplier_id = excluded.supplier_id,
      supplier_name = excluded.supplier_name,
      email = excluded.email,
      description = excluded.description,
      item_description = excluded.item_description,
      status = excluded.status,
      requested_at = excluded.requested_at,
      email_sent_at = excluded.email_sent_at,
      responded_at = excluded.responded_at,
      unit_price = excluded.unit_price,
      delivery_days = excluded.delivery_days,
      validity_days = excluded.validity_days,
      payment_terms = excluded.payment_terms,
      freight = excluded.freight,
      notes = excluded.notes,
      updated_at = excluded.updated_at,
      archived_at = excluded.archived_at`,
    [
      quotation.id,
      valueOrNull(quotation.opportunityId),
      valueOrNull(quotation.opportunityNumber),
      valueOrNull(quotation.itemId),
      valueOrNull(quotation.itemNumber),
      valueOrNull(quotation.supplierId),
      valueOrNull(quotation.supplierName),
      valueOrNull(quotation.email),
      valueOrNull(quotation.description),
      valueOrNull(quotation.itemDescription),
      quotation.status || "Cotacao gerada",
      valueOrNull(quotation.requestedAt),
      valueOrNull(quotation.emailSentAt),
      valueOrNull(quotation.respondedAt),
      valueOrNull(quotation.unitPrice),
      valueOrNull(quotation.deliveryDays),
      valueOrNull(quotation.validityDays),
      valueOrNull(quotation.paymentTerms),
      valueOrNull(quotation.freight),
      valueOrNull(quotation.notes),
      createdAt,
      updatedAt,
      valueOrNull(quotation.archivedAt),
    ]
  );

  return listQuotations(database).find((item) => item.id === quotation.id);
}

export function archiveQuotation(database, id) {
  const existing = database.prepare("SELECT id FROM quotations WHERE id = ? AND archived_at IS NULL").get(id);
  if (!existing) {
    throw new Error("Cotacao nao encontrada.");
  }

  const updatedAt = nowIso();
  runStatement(
    database,
    "UPDATE quotations SET archived_at = ?, updated_at = ? WHERE id = ?",
    [updatedAt, updatedAt, id]
  );

  return { id, archivedAt: updatedAt };
}

function insertProposal(database, proposal) {
  const createdAt = proposal.createdAt || nowIso();
  const updatedAt = proposal.updatedAt || createdAt;

  runStatement(
    database,
    `INSERT INTO proposals (
      id, opportunity_id, opportunity_number, version, status, margin_percent,
      total_value, notes, created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proposal.id,
      valueOrNull(proposal.opportunityId),
      valueOrNull(proposal.opportunityNumber),
      Number(proposal.version || 1),
      proposal.status || "Rascunho",
      valueOrNull(proposal.marginPercent),
      valueOrNull(proposal.totalValue),
      valueOrNull(proposal.notes),
      createdAt,
      updatedAt,
      valueOrNull(proposal.archivedAt),
    ]
  );

  (proposal.items || []).forEach((item) =>
    runStatement(
      database,
      `INSERT INTO proposal_items (
        id, proposal_id, opportunity_item_id, item_number, description,
        quantity, unit, delivery_location, quotation_id, supplier_name,
        cost_unit_price, sale_unit_price, margin_percent, total_sale_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        proposal.id,
        valueOrNull(item.opportunityItemId),
        valueOrNull(item.itemNumber),
        valueOrNull(item.description),
        valueOrNull(item.quantity),
        valueOrNull(item.unit),
        valueOrNull(item.deliveryLocation),
        valueOrNull(item.quotationId),
        valueOrNull(item.supplierName),
        valueOrNull(item.costUnitPrice),
        valueOrNull(item.saleUnitPrice),
        valueOrNull(item.marginPercent),
        valueOrNull(item.totalSalePrice),
      ]
    )
  );
}

export function saveProposal(database, proposal) {
  if (!proposal || !proposal.id) {
    throw new Error("Proposta invalida.");
  }

  const existing = database.prepare("SELECT created_at FROM proposals WHERE id = ?").get(proposal.id);
  const createdAt = existing?.created_at || proposal.createdAt || nowIso();
  const updatedAt = nowIso();

  database.exec("BEGIN TRANSACTION;");
  try {
    runStatement(
      database,
      `INSERT INTO proposals (
        id, opportunity_id, opportunity_number, version, status, margin_percent,
        total_value, notes, created_at, updated_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        opportunity_id = excluded.opportunity_id,
        opportunity_number = excluded.opportunity_number,
        version = excluded.version,
        status = excluded.status,
        margin_percent = excluded.margin_percent,
        total_value = excluded.total_value,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        archived_at = excluded.archived_at`,
      [
        proposal.id,
        valueOrNull(proposal.opportunityId),
        valueOrNull(proposal.opportunityNumber),
        Number(proposal.version || 1),
        proposal.status || "Rascunho",
        valueOrNull(proposal.marginPercent),
        valueOrNull(proposal.totalValue),
        valueOrNull(proposal.notes),
        createdAt,
        updatedAt,
        valueOrNull(proposal.archivedAt),
      ]
    );

    runStatement(database, "DELETE FROM proposal_items WHERE proposal_id = ?", [proposal.id]);

    (proposal.items || []).forEach((item) =>
      runStatement(
        database,
        `INSERT INTO proposal_items (
          id, proposal_id, opportunity_item_id, item_number, description,
          quantity, unit, delivery_location, quotation_id, supplier_name,
          cost_unit_price, sale_unit_price, margin_percent, total_sale_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          proposal.id,
          valueOrNull(item.opportunityItemId),
          valueOrNull(item.itemNumber),
          valueOrNull(item.description),
          valueOrNull(item.quantity),
          valueOrNull(item.unit),
          valueOrNull(item.deliveryLocation),
          valueOrNull(item.quotationId),
          valueOrNull(item.supplierName),
          valueOrNull(item.costUnitPrice),
          valueOrNull(item.saleUnitPrice),
          valueOrNull(item.marginPercent),
          valueOrNull(item.totalSalePrice),
        ]
      )
    );

    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  return listProposals(database).find((item) => item.id === proposal.id);
}

export function archiveProposal(database, id) {
  const existing = database.prepare("SELECT id FROM proposals WHERE id = ? AND archived_at IS NULL").get(id);
  if (!existing) {
    throw new Error("Proposta nao encontrada.");
  }

  const updatedAt = nowIso();
  runStatement(
    database,
    "UPDATE proposals SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?",
    ["Arquivada", updatedAt, updatedAt, id]
  );

  return { id, archivedAt: updatedAt };
}

export function importBackup(database, data) {
  if (!data || !Array.isArray(data.opportunities)) {
    throw new Error("Backup invalido: opportunities ausente.");
  }

  database.exec("BEGIN TRANSACTION;");
  try {
    clearAllData(database);
    (data.opportunities || []).forEach((opportunity) => insertOpportunity(database, opportunity));
    (data.suppliers || []).forEach((supplier) => insertSupplier(database, supplier));
    (data.quotations || []).forEach((quotation) => insertQuotation(database, quotation));
    (data.proposals || []).forEach((proposal) => insertProposal(database, proposal));
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  return getDatabaseSummary(database);
}

export function replaceOpportunities(database, opportunities) {
  if (!Array.isArray(opportunities)) {
    throw new Error("Lista de oportunidades invalida.");
  }

  database.exec("BEGIN TRANSACTION;");
  try {
    clearOpportunities(database);
    opportunities.forEach((opportunity) => insertOpportunity(database, opportunity));
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  return listOpportunities(database, { includeArchived: true });
}

export function updateOpportunityItemQuotationStatus(database, { opportunityId, itemId, status }) {
  if (!opportunityId || !itemId || !status) {
    throw new Error("Oportunidade, item e status sao obrigatorios.");
  }

  const item = database
    .prepare("SELECT id FROM opportunity_items WHERE id = ? AND opportunity_id = ? AND archived_at IS NULL")
    .get(itemId, opportunityId);

  if (!item) {
    throw new Error("Item da oportunidade nao encontrado.");
  }

  const updatedAt = nowIso();
  database.exec("BEGIN TRANSACTION;");
  try {
    runStatement(
      database,
      "UPDATE opportunity_items SET quotation_status = ?, updated_at = ? WHERE id = ? AND opportunity_id = ?",
      [status, updatedAt, itemId, opportunityId]
    );
    runStatement(database, "UPDATE opportunities SET updated_at = ? WHERE id = ?", [updatedAt, opportunityId]);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  return { opportunityId, itemId, status, updatedAt };
}

export function getDatabaseSummary(database) {
  return {
    opportunities: database.prepare("SELECT COUNT(*) AS total FROM opportunities").get().total,
    items: database.prepare("SELECT COUNT(*) AS total FROM opportunity_items").get().total,
    suppliers: database.prepare("SELECT COUNT(*) AS total FROM suppliers").get().total,
    quotations: database.prepare("SELECT COUNT(*) AS total FROM quotations").get().total,
    proposals: database.prepare("SELECT COUNT(*) AS total FROM proposals").get().total,
  };
}

export function exportBackup(database) {
  return {
    version: 1,
    exportedAt: nowIso(),
    opportunities: listOpportunities(database, { includeArchived: true }),
    suppliers: listSuppliers(database, { includeArchived: true }),
    quotations: listQuotations(database, { includeArchived: true }),
    proposals: listProposals(database, { includeArchived: true }),
  };
}

export function listOpportunities(database, { includeArchived = false } = {}) {
  const opportunities = database
    .prepare(
      includeArchived
        ? "SELECT * FROM opportunities ORDER BY created_at DESC"
        : "SELECT * FROM opportunities WHERE archived_at IS NULL ORDER BY created_at DESC"
    )
    .all();
  const items = database
    .prepare(
      includeArchived
        ? "SELECT * FROM opportunity_items"
        : "SELECT * FROM opportunity_items WHERE archived_at IS NULL"
    )
    .all();

  return opportunities.map((opportunity) => ({
    id: opportunity.id,
    sourcePlatform: opportunity.source_platform,
    externalId: opportunity.external_id,
    number: opportunity.number,
    title: opportunity.title,
    dueDate: opportunity.due_date,
    status: opportunity.status,
    importBatchId: opportunity.import_batch_id,
    importFileName: opportunity.import_file_name,
    importedAt: opportunity.imported_at,
    archiveReason: opportunity.archive_reason,
    rawSnapshot: parseJson(opportunity.raw_snapshot, null),
    createdAt: opportunity.created_at,
    updatedAt: opportunity.updated_at,
    archivedAt: opportunity.archived_at,
    items: items
      .filter((item) => item.opportunity_id === opportunity.id)
      .map((item) => ({
        id: item.id,
        itemNumber: item.item_number,
        quantity: item.quantity,
        unit: item.unit,
        deliveryLocation: item.delivery_location,
        attachmentRequired: item.attachment_required,
        quotationStatus: item.quotation_status,
        description: item.description,
        rawDescription: item.raw_description,
        category: item.category,
        standard: item.standard,
        dimensions: item.dimensions,
        standardizedAttributes: parseJson(item.standardized_attributes, {}),
        standardizedSpecifications: parseJson(item.standardized_specifications, []),
        standardizationObservations: parseJson(item.standardization_observations, []),
        manufacturerReferences: parseJson(item.manufacturer_references, []),
        codes: parseJson(item.codes, []),
        manufacturers: parseJson(item.manufacturers, []),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        archivedAt: item.archived_at,
      })),
  }));
}

export function listSuppliers(database, { includeArchived = false } = {}) {
  const suppliers = database
    .prepare(
      includeArchived
        ? "SELECT * FROM suppliers ORDER BY name"
        : "SELECT * FROM suppliers WHERE archived_at IS NULL ORDER BY name"
    )
    .all();
  const specialties = database.prepare("SELECT * FROM supplier_specialties").all();

  return suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    legalName: supplier.legal_name,
    taxId: supplier.tax_id,
    email: supplier.email,
    phone: supplier.phone,
    status: supplier.status,
    notes: supplier.notes,
    createdAt: supplier.created_at,
    updatedAt: supplier.updated_at,
    archivedAt: supplier.archived_at,
    specialties: specialties
      .filter((specialty) => specialty.supplier_id === supplier.id)
      .map((specialty) => ({
        id: specialty.id,
        manufacturer: specialty.manufacturer,
        category: specialty.category,
        notes: specialty.notes,
      })),
  }));
}

export function listQuotations(database, { includeArchived = false } = {}) {
  return database
    .prepare(
      includeArchived
        ? "SELECT * FROM quotations ORDER BY created_at DESC"
        : "SELECT * FROM quotations WHERE archived_at IS NULL ORDER BY created_at DESC"
    )
    .all()
    .map((quotation) => ({
      id: quotation.id,
      opportunityId: quotation.opportunity_id,
      opportunityNumber: quotation.opportunity_number,
      itemId: quotation.item_id,
      itemNumber: quotation.item_number,
      supplierId: quotation.supplier_id,
      supplierName: quotation.supplier_name,
      email: quotation.email,
      description: quotation.description,
      itemDescription: quotation.item_description,
      status: quotation.status,
      requestedAt: quotation.requested_at,
      emailSentAt: quotation.email_sent_at,
      respondedAt: quotation.responded_at,
      unitPrice: quotation.unit_price,
      deliveryDays: quotation.delivery_days,
      validityDays: quotation.validity_days,
      paymentTerms: quotation.payment_terms,
      freight: quotation.freight,
      notes: quotation.notes,
      createdAt: quotation.created_at,
      updatedAt: quotation.updated_at,
      archivedAt: quotation.archived_at,
    }));
}

export function listProposals(database, { includeArchived = false } = {}) {
  const proposals = database
    .prepare(
      includeArchived
        ? "SELECT * FROM proposals ORDER BY created_at DESC"
        : "SELECT * FROM proposals WHERE archived_at IS NULL ORDER BY created_at DESC"
    )
    .all();
  const items = database.prepare("SELECT * FROM proposal_items").all();

  return proposals.map((proposal) => ({
    id: proposal.id,
    opportunityId: proposal.opportunity_id,
    opportunityNumber: proposal.opportunity_number,
    version: proposal.version,
    status: proposal.status,
    marginPercent: proposal.margin_percent,
    totalValue: proposal.total_value,
    notes: proposal.notes,
    createdAt: proposal.created_at,
    updatedAt: proposal.updated_at,
    archivedAt: proposal.archived_at,
    items: items
      .filter((item) => item.proposal_id === proposal.id)
      .map((item) => ({
        id: item.id,
        opportunityItemId: item.opportunity_item_id,
        itemNumber: item.item_number,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        deliveryLocation: item.delivery_location,
        quotationId: item.quotation_id,
        supplierName: item.supplier_name,
        costUnitPrice: item.cost_unit_price,
        saleUnitPrice: item.sale_unit_price,
        marginPercent: item.margin_percent,
        totalSalePrice: item.total_sale_price,
      })),
  }));
}

export { databasePath };
