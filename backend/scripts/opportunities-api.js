import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  return port;
}

const port = await freePort();
const databasePath = join(tmpdir(), `licita-ai-opportunities-${randomUUID()}.sqlite`);
const baseUrl = `http://127.0.0.1:${port}`;

function cleanup() {
  [databasePath, `${databasePath}-shm`, `${databasePath}-wal`].forEach((path) => rmSync(path, { force: true }));
}

async function request(path, { expected = 200, ...options } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  assert(
    response.status === expected,
    `${options.method || "GET"} ${path}: esperado ${expected}, recebido ${response.status}: ${JSON.stringify(body)}`
  );
  return body;
}

const processHandle = spawn(process.execPath, ["src/server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(port), LICITA_AI_DB_PATH: databasePath },
  stdio: "ignore",
  windowsHide: true,
});

try {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      await request("/health");
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  assert(Date.now() < deadline, "Backend temporario nao iniciou.");

  const seedTime = new Date().toISOString();
  await request("/api/import-backup", {
    method: "POST",
    body: JSON.stringify({
      opportunities: [],
      suppliers: [{ id: "preserved-supplier", name: "Fornecedor preservado", createdAt: seedTime }],
      quotations: [{ id: "preserved-quotation", status: "Cotacao gerada", createdAt: seedTime }],
      proposals: [{ id: "preserved-proposal", status: "Rascunho", items: [], createdAt: seedTime }],
    }),
  });

  const created = (
    await request("/api/opportunities", {
      expected: 201,
      method: "POST",
      body: JSON.stringify({ number: "OP-001", title: "Oportunidade manual", status: "Nao analisada" }),
    })
  ).data;
  assert(created.id && created.version === 1 && created.sourcePlatform === "manual", "Criacao da oportunidade invalida.");

  const duplicate = await request("/api/opportunities", {
    expected: 409,
    method: "POST",
    body: JSON.stringify({ number: "  op-001  " }),
  });
  assert(duplicate.error.code === "duplicate", "Duplicidade deveria ter codigo padronizado.");

  const invalidOpportunity = await request("/api/opportunities", {
    expected: 422,
    method: "POST",
    body: JSON.stringify({ title: "Sem numero" }),
  });
  assert(invalidOpportunity.error.code === "validation_error", "Validacao de oportunidade nao padronizada.");
  await request("/api/opportunities", {
    expected: 422,
    method: "POST",
    body: JSON.stringify({ number: "OP-UNKNOWN", unexpected: true }),
  });
  const invalidMediaType = await fetch(`${baseUrl}/api/opportunities`, {
    method: "POST",
    headers: { "Content-Type": "application/json-malformado" },
    body: JSON.stringify({ number: "OP-MEDIA" }),
  });
  assert(invalidMediaType.status === 415, "Content-Type semelhante a JSON contornou a validacao.");

  const updated = (
    await request(`/api/opportunities/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ version: 1, title: "Titulo atualizado" }),
    })
  ).data;
  assert(updated.version === 2 && updated.title === "Titulo atualizado", "Edicao da oportunidade falhou.");

  await request(`/api/opportunities/${created.id}`, {
    expected: 409,
    method: "PATCH",
    body: JSON.stringify({ version: 1, title: "Atualizacao obsoleta" }),
  });
  const afterConflict = (await request(`/api/opportunities/${created.id}`)).data;
  assert(afterConflict.title === "Titulo atualizado", "Conflito causou sobrescrita parcial.");

  await request(`/api/opportunities/${created.id}/items`, {
    expected: 422,
    method: "POST",
    body: JSON.stringify({ description: "Item incompleto", quantity: "2" }),
  });

  const item = (
    await request(`/api/opportunities/${created.id}/items`, {
      expected: 201,
      method: "POST",
      body: JSON.stringify({
        itemNumber: "1",
        description: "Descricao tecnica soberana",
        quantity: "2,5",
        unit: "UN",
        reference: "REF-ERRADA",
        manufacturer: "Fabricante informado",
        deliveryLocation: "Macae/RJ",
        deliveryDeadline: "30 dias",
        technicalNotes: "Manter a descricao como criterio principal.",
      }),
    })
  ).data;
  assert(item.opportunityId === created.id && item.version === 1, "Criacao do item perdeu o relacionamento.");

  const editedItem = (
    await request(`/api/opportunities/${created.id}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ version: 1, description: "Descricao corrigida", reference: "REF-002" }),
    })
  ).data;
  assert(editedItem.version === 2 && editedItem.description === "Descricao corrigida", "Edicao do item falhou.");

  await request(`/api/opportunities/${created.id}/items/${item.id}`, {
    expected: 422,
    method: "PATCH",
    body: JSON.stringify({ version: 2, reference: "NAO-PERSISTIR", quantity: "zero" }),
  });
  const itemAfterValidation = (await request(`/api/opportunities/${created.id}/items/${item.id}`)).data;
  assert(
    itemAfterValidation.reference === "REF-002" && itemAfterValidation.version === 2,
    "Validacao alterou parcialmente o item."
  );

  await request(`/api/opportunities/${created.id}/items/${item.id}`, {
    expected: 409,
    method: "PATCH",
    body: JSON.stringify({ version: 1, unit: "CX" }),
  });
  const itemAfterConflict = (await request(`/api/opportunities/${created.id}/items/${item.id}`)).data;
  assert(itemAfterConflict.unit === "UN" && itemAfterConflict.reference === "REF-002", "Conflito alterou parcialmente o item.");

  const archivedItem = (
    await request(`/api/opportunities/${created.id}/items/${item.id}/archive`, {
      method: "POST",
      body: JSON.stringify({ version: 2 }),
    })
  ).data;
  assert(archivedItem.archivedAt && archivedItem.version === 3, "Arquivamento logico do item falhou.");
  await request(`/api/opportunities/${created.id}/items/${item.id}`, { expected: 404 });
  const restoredItem = (
    await request(`/api/opportunities/${created.id}/items/${item.id}/restore`, {
      method: "POST",
      body: JSON.stringify({ version: 3 }),
    })
  ).data;
  assert(!restoredItem.archivedAt && restoredItem.version === 4, "Restauracao do item falhou.");

  const archived = (
    await request(`/api/opportunities/${created.id}/archive`, {
      method: "POST",
      body: JSON.stringify({ version: 2 }),
    })
  ).data;
  assert(archived.archivedAt && archived.version === 3, "Arquivamento logico da oportunidade falhou.");
  await request(`/api/opportunities/${created.id}`, { expected: 404 });

  const reusedNumber = (
    await request("/api/opportunities", {
      expected: 201,
      method: "POST",
      body: JSON.stringify({ number: "OP-001" }),
    })
  ).data;
  await request(`/api/opportunities/${created.id}/restore`, {
    expected: 409,
    method: "POST",
    body: JSON.stringify({ version: 3 }),
  });
  const archivedReplacement = (
    await request(`/api/opportunities/${reusedNumber.id}/archive`, {
      method: "POST",
      body: JSON.stringify({ version: 1 }),
    })
  ).data;
  assert(archivedReplacement.version === 2, "Arquivamento da oportunidade substituta falhou.");
  const restored = (
    await request(`/api/opportunities/${created.id}/restore`, {
      method: "POST",
      body: JSON.stringify({ version: 3 }),
    })
  ).data;
  assert(!restored.archivedAt && restored.version === 4, "Restauracao da oportunidade falhou.");

  const itemList = (await request(`/api/opportunities/${created.id}/items`)).data;
  assert(itemList.length === 1 && itemList[0].id === item.id, "Listagem granular de itens falhou.");
  const opportunityList = (await request("/api/opportunities?includeArchived=true")).data;
  assert(opportunityList.some((entry) => entry.id === created.id), "Listagem de oportunidades falhou.");

  const legacyPayload = opportunityList.map(({ version: _opportunityVersion, items, ...opportunity }) => ({
    ...opportunity,
    items: items.map(
      ({
        version: _itemVersion,
        reference: _reference,
        manufacturer: _manufacturer,
        deliveryDeadline: _deliveryDeadline,
        technicalNotes: _technicalNotes,
        ...legacyItem
      }) => legacyItem
    ),
  }));

  const legacyPut = await request("/api/opportunities", {
    method: "PUT",
    body: JSON.stringify({ opportunities: legacyPayload }),
  });
  assert(legacyPut.meta?.deprecated === true, "PUT integral nao foi marcado como obsoleto.");
  const itemAfterLegacyPut = (
    await request(`/api/opportunities/${created.id}/items/${item.id}?includeArchived=true`)
  ).data;
  const opportunityAfterLegacyPut = (
    await request(`/api/opportunities/${created.id}?includeArchived=true`)
  ).data;
  assert(
    itemAfterLegacyPut.reference === "REF-002" &&
      itemAfterLegacyPut.manufacturer === "Fabricante informado" &&
      itemAfterLegacyPut.deliveryDeadline === "30 dias" &&
      itemAfterLegacyPut.technicalNotes === "Manter a descricao como criterio principal." &&
      itemAfterLegacyPut.version === 5 &&
      opportunityAfterLegacyPut.version === 5,
    "PUT legado perdeu campos granulares ou reiniciou versoes."
  );

  const summary = (await request("/api/summary")).data;
  assert(summary.suppliers === 1 && summary.quotations === 1 && summary.proposals === 1, "Outros registros foram alterados.");

  console.log("Opportunity API OK.");
  console.log(JSON.stringify({ opportunities: summary.opportunities, items: summary.items, preservedRecords: 3 }, null, 2));
} finally {
  if (processHandle.exitCode === null) {
    processHandle.kill();
    await Promise.race([once(processHandle, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
  cleanup();
}
