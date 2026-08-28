import { randomUUID } from "node:crypto";

const OPPORTUNITY_CREATE_FIELDS = new Set(["number", "title", "dueDate", "status"]);
const OPPORTUNITY_UPDATE_FIELDS = new Set([...OPPORTUNITY_CREATE_FIELDS, "version"]);
const ITEM_CREATE_FIELDS = new Set([
  "itemNumber",
  "description",
  "quantity",
  "unit",
  "reference",
  "manufacturer",
  "deliveryLocation",
  "deliveryDeadline",
  "technicalNotes",
]);
const ITEM_UPDATE_FIELDS = new Set([...ITEM_CREATE_FIELDS, "version"]);

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function failValidation(field, message) {
  throw new ApiError(422, "validation_error", "Contrato invalido.", [{ field, message }]);
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failValidation("body", "deve ser um objeto JSON");
  }
}

function rejectUnknownFields(value, allowed) {
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length) {
    failValidation(unknown[0], "campo nao permitido");
  }
}

function stringField(value, field, { required = false, max }) {
  if (value === undefined) {
    if (required) failValidation(field, "campo obrigatorio");
    return undefined;
  }
  if (value === null && !required) return null;
  if (typeof value !== "string") failValidation(field, "deve ser texto");
  const normalized = value.trim();
  if (required && !normalized) failValidation(field, "nao pode ser vazio");
  if (normalized.length > max) failValidation(field, `deve ter no maximo ${max} caracteres`);
  return normalized || null;
}

function versionField(value) {
  if (!Number.isInteger(value) || value < 1) {
    failValidation("version", "deve ser um inteiro positivo");
  }
  return value;
}

function quantityField(value, required) {
  const quantity = stringField(value, "quantity", { required, max: 50 });
  if (quantity === undefined || quantity === null) return quantity;
  const normalized = quantity.replace(",", ".");
  if (!/^\d+(?:[.,]\d+)?$/.test(quantity) || Number(normalized) <= 0) {
    failValidation("quantity", "deve ser um numero positivo em formato textual");
  }
  return quantity;
}

function validateOpportunityPayload(body, updating) {
  requireObject(body);
  rejectUnknownFields(body, updating ? OPPORTUNITY_UPDATE_FIELDS : OPPORTUNITY_CREATE_FIELDS);
  if (updating && Object.keys(body).every((field) => field === "version")) {
    failValidation("body", "informe ao menos um campo para alterar");
  }
  return {
    number: stringField(body.number, "number", { required: !updating || body.number !== undefined, max: 100 }),
    title: stringField(body.title, "title", { max: 500 }),
    dueDate: stringField(body.dueDate, "dueDate", { max: 50 }),
    status: stringField(body.status, "status", { required: body.status !== undefined, max: 100 }),
    version: updating ? versionField(body.version) : undefined,
  };
}

function validateItemPayload(body, updating) {
  requireObject(body);
  rejectUnknownFields(body, updating ? ITEM_UPDATE_FIELDS : ITEM_CREATE_FIELDS);
  if (updating && Object.keys(body).every((field) => field === "version")) {
    failValidation("body", "informe ao menos um campo para alterar");
  }
  return {
    itemNumber: stringField(body.itemNumber, "itemNumber", { max: 50 }),
    description: stringField(body.description, "description", { required: !updating, max: 10000 }),
    quantity: quantityField(body.quantity, !updating),
    unit: stringField(body.unit, "unit", { required: !updating, max: 50 }),
    reference: stringField(body.reference, "reference", { max: 500 }),
    manufacturer: stringField(body.manufacturer, "manufacturer", { max: 500 }),
    deliveryLocation: stringField(body.deliveryLocation, "deliveryLocation", { max: 1000 }),
    deliveryDeadline: stringField(body.deliveryDeadline, "deliveryDeadline", { max: 500 }),
    technicalNotes: stringField(body.technicalNotes, "technicalNotes", { max: 10000 }),
    version: updating ? versionField(body.version) : undefined,
  };
}

function mapItem(row) {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    itemNumber: row.item_number,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    reference: row.reference,
    manufacturer: row.manufacturer,
    deliveryLocation: row.delivery_location,
    deliveryDeadline: row.delivery_deadline,
    technicalNotes: row.technical_notes,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function mapOpportunity(row, items = []) {
  return {
    id: row.id,
    sourcePlatform: row.source_platform,
    externalId: row.external_id,
    number: row.number,
    title: row.title,
    dueDate: row.due_date,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    items,
  };
}

function getOpportunityRow(database, id) {
  return database.prepare("SELECT * FROM opportunities WHERE id = ?").get(id);
}

function requireOpportunity(database, id, { active = false } = {}) {
  const row = getOpportunityRow(database, id);
  if (!row || (active && row.archived_at)) {
    throw new ApiError(404, "not_found", "Oportunidade nao encontrada.");
  }
  return row;
}

function requireItem(database, opportunityId, itemId) {
  const row = database
    .prepare("SELECT * FROM opportunity_items WHERE id = ? AND opportunity_id = ?")
    .get(itemId, opportunityId);
  if (!row) throw new ApiError(404, "not_found", "Item da oportunidade nao encontrado.");
  return row;
}

function duplicateNumber(database, number, exceptId = null) {
  return database
    .prepare(
      `SELECT id FROM opportunities
       WHERE lower(trim(number)) = lower(trim(?)) AND archived_at IS NULL
         AND (? IS NULL OR id <> ?)`
    )
    .get(number, exceptId, exceptId);
}

function assertUniqueNumber(database, number, exceptId) {
  if (duplicateNumber(database, number, exceptId)) {
    throw new ApiError(409, "duplicate", "Ja existe uma oportunidade ativa com este numero.", {
      field: "number",
    });
  }
}

function conflictOrNotFound(database, table, id, expectedVersion) {
  const row = database.prepare(`SELECT version FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new ApiError(404, "not_found", "Registro nao encontrado.");
  throw new ApiError(409, "conflict", "O registro foi alterado por outra operacao.", {
    expectedVersion,
    currentVersion: row.version,
  });
}

function transaction(database, operation) {
  database.exec("BEGIN IMMEDIATE;");
  try {
    const result = operation();
    database.exec("COMMIT;");
    return result;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function listGranularOpportunities(database, { includeArchived = false } = {}) {
  const rows = database
    .prepare(
      includeArchived
        ? "SELECT * FROM opportunities ORDER BY created_at DESC, id"
        : "SELECT * FROM opportunities WHERE archived_at IS NULL ORDER BY created_at DESC, id"
    )
    .all();
  return rows.map((row) => mapOpportunity(row));
}

export function getGranularOpportunity(database, id, { includeArchived = false } = {}) {
  const row = requireOpportunity(database, id);
  if (row.archived_at && !includeArchived) {
    throw new ApiError(404, "not_found", "Oportunidade nao encontrada.");
  }
  const items = database
    .prepare(
      includeArchived
        ? "SELECT * FROM opportunity_items WHERE opportunity_id = ? ORDER BY created_at, id"
        : "SELECT * FROM opportunity_items WHERE opportunity_id = ? AND archived_at IS NULL ORDER BY created_at, id"
    )
    .all(id)
    .map(mapItem);
  return mapOpportunity(row, items);
}

export function createGranularOpportunity(database, body) {
  const value = validateOpportunityPayload(body, false);
  assertUniqueNumber(database, value.number);
  const id = randomUUID();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO opportunities
       (id, source_platform, number, title, due_date, status, created_at, updated_at, version)
       VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(id, value.number, value.title ?? null, value.dueDate ?? null, value.status || "Nao analisada", now, now);
  return getGranularOpportunity(database, id);
}

export function updateGranularOpportunity(database, id, body) {
  const value = validateOpportunityPayload(body, true);
  const current = requireOpportunity(database, id, { active: true });
  const nextNumber = value.number === undefined ? current.number : value.number;
  assertUniqueNumber(database, nextNumber, id);
  const next = {
    number: nextNumber,
    title: value.title === undefined ? current.title : value.title,
    dueDate: value.dueDate === undefined ? current.due_date : value.dueDate,
    status: value.status === undefined ? current.status : value.status,
  };
  const result = database
    .prepare(
      `UPDATE opportunities SET number = ?, title = ?, due_date = ?, status = ?,
       updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`
    )
    .run(next.number, next.title, next.dueDate, next.status, new Date().toISOString(), id, value.version);
  if (result.changes !== 1) conflictOrNotFound(database, "opportunities", id, value.version);
  return getGranularOpportunity(database, id, { includeArchived: true });
}

function setOpportunityArchived(database, id, body, restoring) {
  requireObject(body);
  rejectUnknownFields(body, new Set(["version"]));
  const version = versionField(body.version);
  const current = requireOpportunity(database, id);
  if (restoring && !current.archived_at) {
    throw new ApiError(409, "conflict", "A oportunidade ja esta ativa.");
  }
  if (!restoring && current.archived_at) {
    throw new ApiError(409, "conflict", "A oportunidade ja esta arquivada.");
  }
  if (restoring) assertUniqueNumber(database, current.number, id);
  const now = new Date().toISOString();
  const result = database
    .prepare(
      `UPDATE opportunities SET archived_at = ?, updated_at = ?, version = version + 1
       WHERE id = ? AND version = ?`
    )
    .run(restoring ? null : now, now, id, version);
  if (result.changes !== 1) conflictOrNotFound(database, "opportunities", id, version);
  return getGranularOpportunity(database, id, { includeArchived: true });
}

export function archiveGranularOpportunity(database, id, body) {
  return setOpportunityArchived(database, id, body, false);
}

export function restoreGranularOpportunity(database, id, body) {
  return setOpportunityArchived(database, id, body, true);
}

export function listGranularItems(database, opportunityId, { includeArchived = false } = {}) {
  requireOpportunity(database, opportunityId, { active: !includeArchived });
  return database
    .prepare(
      includeArchived
        ? "SELECT * FROM opportunity_items WHERE opportunity_id = ? ORDER BY created_at, id"
        : "SELECT * FROM opportunity_items WHERE opportunity_id = ? AND archived_at IS NULL ORDER BY created_at, id"
    )
    .all(opportunityId)
    .map(mapItem);
}

export function getGranularItem(database, opportunityId, itemId, { includeArchived = false } = {}) {
  requireOpportunity(database, opportunityId, { active: !includeArchived });
  const row = requireItem(database, opportunityId, itemId);
  if (row.archived_at && !includeArchived) {
    throw new ApiError(404, "not_found", "Item da oportunidade nao encontrado.");
  }
  return mapItem(row);
}

export function createGranularItem(database, opportunityId, body) {
  const value = validateItemPayload(body, false);
  requireOpportunity(database, opportunityId, { active: true });
  const id = randomUUID();
  const now = new Date().toISOString();
  return transaction(database, () => {
    database
      .prepare(
        `INSERT INTO opportunity_items
         (id, opportunity_id, item_number, description, quantity, unit, reference, manufacturer,
          delivery_location, delivery_deadline, technical_notes, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        id,
        opportunityId,
        value.itemNumber ?? null,
        value.description,
        value.quantity,
        value.unit,
        value.reference ?? null,
        value.manufacturer ?? null,
        value.deliveryLocation ?? null,
        value.deliveryDeadline ?? null,
        value.technicalNotes ?? null,
        now,
        now
      );
    database.prepare("UPDATE opportunities SET updated_at = ? WHERE id = ?").run(now, opportunityId);
    return getGranularItem(database, opportunityId, id);
  });
}

export function updateGranularItem(database, opportunityId, itemId, body) {
  const value = validateItemPayload(body, true);
  requireOpportunity(database, opportunityId, { active: true });
  const current = requireItem(database, opportunityId, itemId);
  if (current.archived_at) throw new ApiError(404, "not_found", "Item da oportunidade nao encontrado.");
  const required = {
    description: value.description === undefined ? current.description : value.description,
    quantity: value.quantity === undefined ? current.quantity : value.quantity,
    unit: value.unit === undefined ? current.unit : value.unit,
  };
  if (!required.description) failValidation("description", "nao pode ser vazio");
  if (!required.quantity) failValidation("quantity", "nao pode ser vazio");
  if (!required.unit) failValidation("unit", "nao pode ser vazio");
  const next = {
    itemNumber: value.itemNumber === undefined ? current.item_number : value.itemNumber,
    ...required,
    reference: value.reference === undefined ? current.reference : value.reference,
    manufacturer: value.manufacturer === undefined ? current.manufacturer : value.manufacturer,
    deliveryLocation: value.deliveryLocation === undefined ? current.delivery_location : value.deliveryLocation,
    deliveryDeadline: value.deliveryDeadline === undefined ? current.delivery_deadline : value.deliveryDeadline,
    technicalNotes: value.technicalNotes === undefined ? current.technical_notes : value.technicalNotes,
  };
  const now = new Date().toISOString();
  return transaction(database, () => {
    const result = database
      .prepare(
        `UPDATE opportunity_items SET item_number = ?, description = ?, quantity = ?, unit = ?,
         reference = ?, manufacturer = ?, delivery_location = ?, delivery_deadline = ?, technical_notes = ?,
         updated_at = ?, version = version + 1
         WHERE id = ? AND opportunity_id = ? AND version = ?`
      )
      .run(
        next.itemNumber,
        next.description,
        next.quantity,
        next.unit,
        next.reference,
        next.manufacturer,
        next.deliveryLocation,
        next.deliveryDeadline,
        next.technicalNotes,
        now,
        itemId,
        opportunityId,
        value.version
      );
    if (result.changes !== 1) conflictOrNotFound(database, "opportunity_items", itemId, value.version);
    database.prepare("UPDATE opportunities SET updated_at = ? WHERE id = ?").run(now, opportunityId);
    return getGranularItem(database, opportunityId, itemId, { includeArchived: true });
  });
}

function setItemArchived(database, opportunityId, itemId, body, restoring) {
  requireObject(body);
  rejectUnknownFields(body, new Set(["version"]));
  const version = versionField(body.version);
  requireOpportunity(database, opportunityId, { active: true });
  const current = requireItem(database, opportunityId, itemId);
  if (restoring && !current.archived_at) throw new ApiError(409, "conflict", "O item ja esta ativo.");
  if (!restoring && current.archived_at) throw new ApiError(409, "conflict", "O item ja esta arquivado.");
  const now = new Date().toISOString();
  return transaction(database, () => {
    const result = database
      .prepare(
        `UPDATE opportunity_items SET archived_at = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND opportunity_id = ? AND version = ?`
      )
      .run(restoring ? null : now, now, itemId, opportunityId, version);
    if (result.changes !== 1) conflictOrNotFound(database, "opportunity_items", itemId, version);
    database.prepare("UPDATE opportunities SET updated_at = ? WHERE id = ?").run(now, opportunityId);
    return getGranularItem(database, opportunityId, itemId, { includeArchived: true });
  });
}

export function archiveGranularItem(database, opportunityId, itemId, body) {
  return setItemArchived(database, opportunityId, itemId, body, false);
}

export function restoreGranularItem(database, opportunityId, itemId, body) {
  return setItemArchived(database, opportunityId, itemId, body, true);
}
