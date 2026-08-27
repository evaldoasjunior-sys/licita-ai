import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function findFreePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  return port;
}

const TEST_PORT = await findFreePort();
const TEST_DATABASE_PATH = join(tmpdir(), `licita-ai-smoke-api-${randomUUID()}.sqlite`);
const API_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function removeTestDatabase() {
  [TEST_DATABASE_PATH, `${TEST_DATABASE_PATH}-shm`, `${TEST_DATABASE_PATH}-wal`].forEach((filePath) =>
    rmSync(filePath, { force: true })
  );
}

function createSmokeBackup() {
  const now = new Date().toISOString();

  return {
    version: 1,
    exportedAt: now,
    opportunities: [
      {
        id: "api_smoke_op",
        sourcePlatform: "word",
        externalId: "API-SMOKE-001",
        number: "API-SMOKE-001",
        title: "Smoke API",
        dueDate: "30/07/2026",
        status: "Nao analisada",
        importBatchId: "api_smoke_batch",
        importFileName: "api-smoke.docx",
        importedAt: now,
        archiveReason: "",
        rawSnapshot: { source: "api-smoke-test" },
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        items: [
          {
            id: "api_smoke_item",
            itemNumber: "1",
            quantity: "1",
            unit: "UN",
            deliveryLocation: "Macae/RJ",
            attachmentRequired: "",
            quotationStatus: "Cotacao gerada",
            description: "Item API smoke",
            rawDescription: "Item API smoke ;Tp: PARKER 020AA",
            category: "Elemento filtrante coalescedor",
            standard: "",
            dimensions: "",
            standardizedAttributes: {},
            standardizedSpecifications: ["Tp: PARKER 020AA"],
            standardizationObservations: [],
            manufacturerReferences: [{ manufacturer: "PARKER", codes: ["020AA"], fragment: "Tp: PARKER 020AA" }],
            codes: [{ id: "api_smoke_code", type: "Geral", value: "020AA" }],
            manufacturers: [{ id: "api_smoke_manufacturer", name: "PARKER" }],
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          },
        ],
      },
    ],
    suppliers: [
      {
        id: "api_smoke_supplier",
        name: "API SMOKE FORNECEDOR",
        legalName: "",
        taxId: "",
        email: "api-smoke@example.com",
        phone: "",
        status: "Ativo",
        notes: "",
        specialties: [{ id: "api_smoke_specialty", manufacturer: "PARKER", category: "Elemento filtrante coalescedor", notes: "" }],
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    ],
    quotations: [
      {
        id: "api_smoke_quotation",
        opportunityId: "api_smoke_op",
        opportunityNumber: "API-SMOKE-001",
        itemId: "api_smoke_item",
        itemNumber: "1",
        supplierId: "api_smoke_supplier",
        supplierName: "API SMOKE FORNECEDOR",
        email: "api-smoke@example.com",
        description: "Cotacao API smoke",
        itemDescription: "Item API smoke",
        status: "Cotacao gerada",
        requestedAt: "08/07/2026",
        emailSentAt: "",
        respondedAt: "",
        unitPrice: "",
        deliveryDays: "",
        validityDays: "",
        paymentTerms: "",
        freight: "",
        notes: "",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
    ],
    proposals: [],
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${path} respondeu HTTP ${response.status}: ${data.message || "erro sem mensagem"}`);
  }

  return data;
}

async function isServerOnline() {
  try {
    await requestJson("/health");
    return true;
  } catch {
    return false;
  }
}

function startServer() {
  return spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      LICITA_AI_DB_PATH: TEST_DATABASE_PATH,
    },
    stdio: "ignore",
    windowsHide: true,
  });
}

async function waitForServer() {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (await isServerOnline()) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`Backend de teste nao respondeu em ${API_BASE_URL}.`);
}

const serverProcess = startServer();

try {
  await waitForServer();

  const allowedOriginResponse = await fetch(`${API_BASE_URL}/health`, {
    headers: { Origin: "http://127.0.0.1:5173" },
  });
  assert(allowedOriginResponse.status === 200, "A origem local do frontend deveria ser aceita.");
  assert(
    allowedOriginResponse.headers.get("access-control-allow-origin") === "http://127.0.0.1:5173",
    "A API deveria autorizar apenas a origem local recebida."
  );

  const blockedOriginResponse = await fetch(`${API_BASE_URL}/api/summary`, {
    headers: { Origin: "https://origem-nao-autorizada.example" },
  });
  assert(blockedOriginResponse.status === 403, "Uma origem externa deveria ser bloqueada.");

  await requestJson("/api/import-backup", {
    method: "POST",
    body: JSON.stringify(createSmokeBackup()),
  });

  const [api, summary, opportunities, suppliers, quotations, proposals] = await Promise.all([
    requestJson("/api"),
    requestJson("/api/summary"),
    requestJson("/api/opportunities?includeArchived=true"),
    requestJson("/api/suppliers?includeArchived=true"),
    requestJson("/api/quotations?includeArchived=true"),
    requestJson("/api/proposals?includeArchived=true"),
  ]);

  assert(api.name === "LICITA AI API", "API raiz nao retornou o nome esperado.");
  assert(summary.data.opportunities === 1, "Resumo da API deveria conter 1 oportunidade.");
  assert(summary.data.suppliers === 1, "Resumo da API deveria conter 1 fornecedor.");
  assert(summary.data.quotations === 1, "Resumo da API deveria conter 1 cotacao.");
  assert(opportunities.data.length === 1, "Lista de oportunidades deveria conter 1 registro.");
  assert(suppliers.data.length === 1, "Lista de fornecedores deveria conter 1 registro.");
  assert(quotations.data.length === 1, "Lista de cotacoes deveria conter 1 registro.");
  assert(Array.isArray(proposals.data), "Lista de propostas deveria retornar um array.");

  const updatedItemStatus = await requestJson(
    "/api/opportunities/api_smoke_op/items/api_smoke_item/quotation-status",
    {
      method: "PATCH",
      body: JSON.stringify({ status: "Respondido" }),
    }
  );
  assert(updatedItemStatus.data.status === "Respondido", "PATCH do status do item nao retornou o novo status.");
  const opportunitiesAfterItemUpdate = await requestJson("/api/opportunities?includeArchived=true");
  assert(
    opportunitiesAfterItemUpdate.data[0].items[0].quotationStatus === "Respondido",
    "PATCH do status do item nao persistiu no SQLite."
  );

  const createdSupplier = await requestJson("/api/suppliers", {
    method: "POST",
    body: JSON.stringify({
      id: "api_crud_supplier",
      name: "FORNECEDOR CRUD",
      email: "crud@example.com",
      status: "Ativo",
      specialties: [
        {
          id: "api_crud_specialty",
          manufacturer: "PARKER",
          category: "Filtros",
          notes: "Criado pelo smoke test",
        },
      ],
    }),
  });
  assert(createdSupplier.data.name === "FORNECEDOR CRUD", "POST de fornecedor nao persistiu o nome.");

  const updatedSupplier = await requestJson("/api/suppliers/api_crud_supplier", {
    method: "PUT",
    body: JSON.stringify({
      ...createdSupplier.data,
      phone: "(22) 99999-0000",
    }),
  });
  assert(updatedSupplier.data.phone === "(22) 99999-0000", "PUT de fornecedor nao persistiu o telefone.");

  await requestJson("/api/suppliers/api_crud_supplier", { method: "DELETE" });
  const suppliersAfterDelete = await requestJson("/api/suppliers?includeArchived=true");
  assert(
    suppliersAfterDelete.data.some((supplier) => supplier.id === "api_crud_supplier" && supplier.archivedAt),
    "DELETE de fornecedor nao arquivou o registro."
  );

  const createdQuotation = await requestJson("/api/quotations", {
    method: "POST",
    body: JSON.stringify({
      id: "api_crud_quotation",
      opportunityId: "api_smoke_op",
      opportunityNumber: "API-SMOKE-001",
      itemId: "api_smoke_item",
      itemNumber: "1",
      supplierId: "api_smoke_supplier",
      supplierName: "API SMOKE FORNECEDOR",
      status: "Cotacao gerada",
      requestedAt: "13/07/2026",
    }),
  });
  assert(createdQuotation.data.status === "Cotacao gerada", "POST de cotacao nao persistiu o status.");

  const updatedQuotation = await requestJson("/api/quotations/api_crud_quotation", {
    method: "PUT",
    body: JSON.stringify({
      ...createdQuotation.data,
      status: "Respondido",
      unitPrice: "1250,00",
    }),
  });
  assert(updatedQuotation.data.unitPrice === "1250,00", "PUT de cotacao nao persistiu o preco.");

  await requestJson("/api/quotations/api_crud_quotation", { method: "DELETE" });
  const quotationsAfterDelete = await requestJson("/api/quotations?includeArchived=true");
  assert(
    quotationsAfterDelete.data.some((quotation) => quotation.id === "api_crud_quotation" && quotation.archivedAt),
    "DELETE de cotacao nao arquivou o registro."
  );

  const createdProposal = await requestJson("/api/proposals", {
    method: "POST",
    body: JSON.stringify({
      id: "api_crud_proposal",
      opportunityId: "api_smoke_op",
      opportunityNumber: "API-SMOKE-001",
      version: 1,
      status: "Rascunho",
      marginPercent: "20",
      totalValue: "1500.00",
      items: [
        {
          id: "api_crud_proposal_item",
          opportunityItemId: "api_smoke_item",
          itemNumber: "1",
          description: "Item API smoke",
          quantity: "1",
          unit: "UN",
          quotationId: "api_smoke_quotation",
          supplierName: "API SMOKE FORNECEDOR",
          costUnitPrice: "1250.00",
          saleUnitPrice: "1500.00",
          marginPercent: "20",
          totalSalePrice: "1500.00",
        },
      ],
    }),
  });
  assert(createdProposal.data.items.length === 1, "POST de proposta nao persistiu os itens.");

  const updatedProposal = await requestJson("/api/proposals/api_crud_proposal", {
    method: "PUT",
    body: JSON.stringify({
      ...createdProposal.data,
      status: "Pronta para envio",
    }),
  });
  assert(updatedProposal.data.status === "Pronta para envio", "PUT de proposta nao persistiu o status.");

  await requestJson("/api/proposals/api_crud_proposal", { method: "DELETE" });
  const proposalsAfterDelete = await requestJson("/api/proposals?includeArchived=true");
  assert(
    proposalsAfterDelete.data.some((proposal) => proposal.id === "api_crud_proposal" && proposal.archivedAt),
    "DELETE de proposta nao arquivou o registro."
  );

  const replacedOpportunities = await requestJson("/api/opportunities", {
    method: "PUT",
    body: JSON.stringify({ opportunities: opportunities.data }),
  });
  assert(replacedOpportunities.data.length === 1, "PUT de oportunidades nao persistiu a lista.");

  console.log("Smoke API OK.");
  console.log(JSON.stringify(summary.data, null, 2));
} finally {
  if (serverProcess.exitCode === null) {
    serverProcess.kill();
    await Promise.race([
      once(serverProcess, "exit"),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  removeTestDatabase();
}
