import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getDatabaseSummary,
  importBackup,
  initializeDatabase,
  listOpportunities,
  listProposals,
  listQuotations,
  listSuppliers,
} from "../src/database.js";

const testDatabasePath = join(tmpdir(), `licita-ai-smoke-flow-${randomUUID()}.sqlite`);

function removeTestDatabase() {
  [testDatabasePath, `${testDatabasePath}-shm`, `${testDatabasePath}-wal`].forEach((filePath) =>
    rmSync(filePath, { force: true })
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function demoBackup() {
  const now = new Date().toISOString();

  return {
    version: 1,
    exportedAt: now,
    opportunities: [
      {
        id: "smoke_op_active",
        sourcePlatform: "word",
        externalId: "SMOKE-001",
        number: "SMOKE-001",
        title: "Teste automatico",
        dueDate: "30/07/2026",
        status: "Nao analisada",
        importBatchId: "smoke_batch_active",
        importFileName: "smoke.docx",
        importedAt: now,
        archiveReason: "",
        rawSnapshot: { source: "smoke-test" },
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        items: [
          {
            id: "smoke_item_active",
            itemNumber: "1",
            quantity: "2",
            unit: "UN",
            deliveryLocation: "Macae/RJ",
            attachmentRequired: "",
            quotationStatus: "Respondido",
            description: "Caixa de armazenagem demo",
            rawDescription: "Caixa de armazenagem demo ;Tp: TEKIN TK10213",
            category: "Caixa de armazenagem",
            standard: "",
            dimensions: "",
            standardizedAttributes: {},
            standardizedSpecifications: ["Tp: TEKIN TK10213"],
            standardizationObservations: [],
            manufacturerReferences: [{ manufacturer: "TEKIN", codes: ["TK10213"], fragment: "Tp: TEKIN TK10213" }],
            codes: [{ id: "smoke_code", type: "Geral", value: "TK10213" }],
            manufacturers: [{ id: "smoke_manufacturer", name: "TEKIN" }],
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          },
        ],
      },
      {
        id: "smoke_op_archived",
        sourcePlatform: "word",
        externalId: "SMOKE-000",
        number: "SMOKE-000",
        title: "Historico automatico",
        dueDate: "15/07/2026",
        status: "Nao analisada",
        importBatchId: "smoke_batch_archived",
        importFileName: "smoke-antigo.docx",
        importedAt: now,
        archiveReason: "Substituida por nova importacao",
        rawSnapshot: { source: "smoke-test" },
        createdAt: now,
        updatedAt: now,
        archivedAt: now,
        items: [],
      },
    ],
    suppliers: [
      {
        id: "smoke_supplier",
        name: "FORNECEDOR SMOKE LTDA",
        legalName: "",
        taxId: "",
        email: "smoke@example.com",
        phone: "",
        status: "Ativo",
        notes: "",
        specialties: [{ id: "smoke_specialty", manufacturer: "TEKIN", category: "Caixa de armazenagem", notes: "" }],
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    ],
    quotations: [
      {
        id: "smoke_quotation",
        opportunityId: "smoke_op_active",
        opportunityNumber: "SMOKE-001",
        itemId: "smoke_item_active",
        itemNumber: "1",
        supplierId: "smoke_supplier",
        supplierName: "FORNECEDOR SMOKE LTDA",
        email: "smoke@example.com",
        description: "Cotacao smoke",
        itemDescription: "Caixa de armazenagem demo",
        status: "Respondido",
        requestedAt: "08/07/2026",
        emailSentAt: "08/07/2026",
        respondedAt: "08/07/2026",
        unitPrice: "1000,00",
        deliveryDays: "30 dias",
        validityDays: "10 dias",
        paymentTerms: "28 dias",
        freight: "CIF",
        notes: "",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    ],
    proposals: [
      {
        id: "smoke_proposal",
        opportunityId: "smoke_op_active",
        opportunityNumber: "SMOKE-001",
        version: 1,
        status: "Rascunho",
        marginPercent: "20",
        totalValue: "2400.00",
        notes: "Proposta smoke",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        items: [
          {
            id: "smoke_proposal_item",
            opportunityItemId: "smoke_item_active",
            itemNumber: "1",
            description: "Caixa de armazenagem demo",
            quantity: "2",
            unit: "UN",
            deliveryLocation: "Macae/RJ",
            quotationId: "smoke_quotation",
            supplierName: "FORNECEDOR SMOKE LTDA",
            costUnitPrice: "1000.00",
            saleUnitPrice: "1200.00",
            marginPercent: "20",
            totalSalePrice: "2400.00",
          },
        ],
      },
    ],
  };
}

const database = initializeDatabase(testDatabasePath);

try {
  importBackup(database, demoBackup());

  const summary = getDatabaseSummary(database);
  const appliedMigrations = database.prepare("SELECT version FROM schema_migrations ORDER BY version").all();
  const activeOpportunities = listOpportunities(database);
  const allOpportunities = listOpportunities(database, { includeArchived: true });
  const suppliers = listSuppliers(database);
  const quotations = listQuotations(database);
  const proposals = listProposals(database);

  assert(summary.opportunities === 2, "Resumo deveria conter 2 oportunidades.");
  assert(appliedMigrations.some((migration) => migration.version === "001_initial.sql"), "Migracao inicial nao aplicada.");
  assert(
    appliedMigrations.some((migration) => migration.version === "002_granular_opportunities.sql"),
    "Migracao granular nao aplicada."
  );
  assert(summary.items === 1, "Resumo deveria conter 1 item.");
  assert(activeOpportunities.length === 1, "Deveria haver 1 oportunidade ativa.");
  assert(allOpportunities.length === 2, "Historico deveria preservar oportunidade arquivada.");
  assert(suppliers.length === 1, "Deveria haver 1 fornecedor ativo.");
  assert(quotations.length === 1 && quotations[0].status === "Respondido", "Cotacao respondida nao encontrada.");
  assert(proposals.length === 1 && proposals[0].items.length === 1, "Proposta com item nao encontrada.");

  const reopened = initializeDatabase(testDatabasePath);
  const migrationCount = reopened.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get().total;
  reopened.close();
  assert(migrationCount === appliedMigrations.length, "Reaplicacao idempotente duplicou migracoes.");

  console.log("Smoke flow OK.");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  database.close();
  removeTestDatabase();
}
