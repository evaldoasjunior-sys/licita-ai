import {
  createOpportunityDraftStore,
  createWordImportState,
  confirmImportItemUnit,
  executeOpportunityDraft,
  filterOpportunities,
  importWordGranular,
  importItemsWithoutUnit,
  itemPayload,
  opportunityPayload,
  updateImportItemUnit,
  validateItemForm,
  validateOpportunityForm,
} from "../src/services/opportunityManagement.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

assert(validateOpportunityForm({ number: "" }).number, "Numero deveria ser obrigatorio.");
assert(validateItemForm({ description: "", quantity: "zero", unit: "" }).description, "Descricao deveria ser obrigatoria.");
assert(validateItemForm({ description: "Item", quantity: "zero", unit: "UN" }).quantity, "Quantidade invalida foi aceita.");
assert(Object.keys(validateItemForm({ description: "Item", quantity: "2,5", unit: "UN" })).length === 0, "Item valido foi rejeitado.");

const opportunities = [
  { id: "active-1", number: "ABC-100", title: "Bombas", status: "Em analise", dueDate: "05/09/2026", archivedAt: null, items: [{ description: "Bomba centrifuga", reference: "REF-9", manufacturer: "ACME" }] },
  { id: "active-2", number: "ABC-200", title: "Valvulas", status: "Cotando", dueDate: "", archivedAt: null, items: [] },
  { id: "archived", number: "OLD-1", title: "Historico", status: "Encerrada", dueDate: "01/08/2026", archivedAt: "x", items: [] },
];
assert(filterOpportunities(opportunities, { archived: false, search: "ref-9", status: "all", deadline: "all" }).length === 1, "Pesquisa por referencia falhou.");
assert(filterOpportunities(opportunities, { archived: false, search: "acme", status: "all", deadline: "all" }).length === 1, "Pesquisa por fabricante falhou.");
assert(filterOpportunities(opportunities, { archived: false, search: "", status: "Cotando", deadline: "all" }).length === 1, "Filtro de situacao falhou.");
assert(filterOpportunities(opportunities, { archived: false, search: "", status: "all", deadline: "7" }, new Date("2026-08-30T12:00:00")).length === 1, "Filtro de prazo falhou.");
assert(filterOpportunities(opportunities, { archived: true, search: "", status: "all", deadline: "all" }).length === 1, "Alternancia de arquivadas falhou.");

const calls = [];
const api = {
  createOpportunity: async (payload) => { calls.push(["create-opportunity", payload]); return { data: { id: "op-new", version: 1 } }; },
  updateOpportunity: async (id, payload) => { calls.push(["update-opportunity", id, payload]); return { data: { id, ...payload, version: payload.version + 1 } }; },
  archiveOpportunity: async (id, version) => { calls.push(["archive-opportunity", id, version]); return { data: { id, version: version + 1, archivedAt: "now" } }; },
  restoreOpportunity: async (id, version) => { calls.push(["restore-opportunity", id, version]); return { data: { id, version: version + 1, archivedAt: null } }; },
  createOpportunityItem: async (id, payload) => { calls.push(["create-item", id, payload]); return { data: { id: `item-${calls.length}`, opportunityId: id, ...payload, version: 1 } }; },
  updateOpportunityItem: async (opportunityId, itemId, payload) => { calls.push(["update-item", opportunityId, itemId, payload]); return { data: { id: itemId, ...payload, version: payload.version + 1 } }; },
  archiveOpportunityItem: async (opportunityId, itemId, version) => { calls.push(["archive-item", opportunityId, itemId, version]); return { data: { id: itemId, version: version + 1 } }; },
  restoreOpportunityItem: async (opportunityId, itemId, version) => { calls.push(["restore-item", opportunityId, itemId, version]); return { data: { id: itemId, version: version + 1 } }; },
};

await executeOpportunityDraft(api, { type: "opportunity-create", payload: opportunityPayload({ number: "NEW-1" }) });
await executeOpportunityDraft(api, { type: "opportunity-update", opportunityId: "op-new", payload: { title: "Nova", version: 1 } });
await executeOpportunityDraft(api, { type: "opportunity-archive", opportunityId: "op-new", payload: { version: 2 } });
await executeOpportunityDraft(api, { type: "opportunity-restore", opportunityId: "op-new", payload: { version: 3 } });
const validItem = itemPayload({ description: "Descricao soberana", quantity: "1", unit: "UN", reference: "R", manufacturer: "M" });
await executeOpportunityDraft(api, { type: "item-create", opportunityId: "op-new", payload: validItem });
await executeOpportunityDraft(api, { type: "item-update", opportunityId: "op-new", itemId: "item-1", payload: { ...validItem, version: 1 } });
await executeOpportunityDraft(api, { type: "item-archive", opportunityId: "op-new", itemId: "item-1", payload: { version: 2 } });
await executeOpportunityDraft(api, { type: "item-restore", opportunityId: "op-new", itemId: "item-1", payload: { version: 3 } });
assert(calls.some(([type]) => type === "create-opportunity") && calls.some(([type]) => type === "restore-item"), "CRUD granular incompleto.");

const storage = memoryStorage();
const drafts = createOpportunityDraftStore(storage);
const offlineDraft = { type: "opportunity-create", payload: { number: "OFF-1" } };
try {
  await executeOpportunityDraft({ createOpportunity: async () => { throw new TypeError("offline"); } }, offlineDraft);
} catch (error) {
  drafts.save({ ...offlineDraft, lastError: error.message });
}
assert(drafts.list().length === 1 && drafts.list()[0].payload.number === "OFF-1", "Falha offline perdeu o rascunho.");
await executeOpportunityDraft(api, drafts.list()[0]);
drafts.remove(drafts.list()[0].id);
assert(drafts.list().length === 0, "Reconexao nao confirmou o rascunho.");

const conflictDraft = drafts.save({ type: "opportunity-update", opportunityId: "op-new", payload: { title: "Meu rascunho", version: 1 } });
const remote = { title: "Atualizacao remota", version: 2 };
let conflictObserved = false;
try {
  await executeOpportunityDraft({ updateOpportunity: async () => { const error = new Error("conflict"); error.status = 409; error.code = "conflict"; throw error; } }, conflictDraft);
} catch {
  conflictObserved = true;
}
assert(conflictObserved, "Conflito de versao nao foi propagado.");
assert(drafts.list()[0].payload.title === "Meu rascunho" && remote.title === "Atualizacao remota", "Conflito sobrescreveu dados ou perdeu o rascunho.");

let putCalls = 0;
const identifiedCalls = [];
const identifiedState = createWordImportState([{ number: "WORD-UNIT", items: [
  { description: "Item com unidade", quantity: "3 CX", unit: "" },
] }]);
assert(identifiedState.opportunities[0].items[0].quantity === "3", "Quantidade com unidade nao foi separada.");
assert(identifiedState.opportunities[0].items[0].unit === "CX", "Unidade identificada no Word nao foi preservada.");
assert(importItemsWithoutUnit(identifiedState).length === 0, "Item com unidade foi marcado para revisao indevidamente.");
await importWordGranular({
  saveOpportunities: async () => { putCalls += 1; },
  createOpportunity: async () => ({ data: { id: "identified-op" } }),
  createOpportunityItem: async (_id, payload) => { identifiedCalls.push(payload); return { data: {} }; },
}, identifiedState);
assert(identifiedCalls.length === 1 && identifiedCalls[0].unit === "CX", "Item com unidade identificada nao foi gravado corretamente.");
assert(identifiedCalls[0].unitConfirmed === undefined, "Metadados do rascunho vazaram para o contrato da API.");

const reviewCalls = [];
const reviewState = createWordImportState([{ number: "WORD-REVIEW", title: "arquivo.docx", items: [
  { description: "Item identificado", quantity: "1 UN", unit: "" },
  { description: "Item sem unidade", quantity: "2", unit: "", reference: "REF-X" },
] }]);
let reviewError = null;
const unitDrafts = createOpportunityDraftStore(memoryStorage());
try {
  await importWordGranular({
    createOpportunity: async () => { reviewCalls.push("op"); return { data: { id: "review-op" } }; },
    createOpportunityItem: async () => { reviewCalls.push("item"); return { data: {} }; },
  }, reviewState);
} catch (error) {
  reviewError = error;
  unitDrafts.save({ type: "word-import", payload: error.importState, lastError: error.message });
}
assert(reviewError?.code === "unit_review_required", "Importacao sem unidade nao exigiu revisao.");
assert(reviewCalls.length === 0, "Importacao gravou dados antes da revisao da unidade.");
assert(importItemsWithoutUnit(reviewState).length === 1, "Item sem unidade nao foi destacado para revisao.");
assert(reviewState.opportunities[0].items[1].unit === "", "Unidade ausente recebeu valor automatico.");
assert(reviewState.opportunities[0].items[1].reference === "REF-X", "Dados do item pendente foram descartados.");
assert(unitDrafts.list().length === 1, "Item sem unidade nao foi preservado como rascunho.");
const filledState = updateImportItemUnit(unitDrafts.list()[0].payload, 0, 1, "KG");
assert(importItemsWithoutUnit(filledState).length === 1, "Unidade digitada foi aceita sem confirmacao do usuario.");
let unconfirmedError = null;
try {
  await importWordGranular({ createOpportunity: async () => ({ data: { id: "unexpected" } }) }, filledState);
} catch (error) {
  unconfirmedError = error;
}
assert(unconfirmedError?.code === "unit_review_required", "Item foi gravado antes da confirmacao da unidade.");
const reviewedState = confirmImportItemUnit(filledState, 0, 1);
assert(importItemsWithoutUnit(reviewedState).length === 0, "Unidade confirmada continuou pendente.");
const reviewedItems = [];
await importWordGranular({
  createOpportunity: async () => ({ data: { id: "review-op" } }),
  createOpportunityItem: async (_id, payload) => { reviewedItems.push(payload); return { data: {} }; },
}, reviewedState);
assert(reviewedItems.length === 2 && reviewedItems[1].unit === "KG", "Retomada apos preenchimento da unidade falhou.");
unitDrafts.remove(unitDrafts.list()[0].id);
assert(unitDrafts.list().length === 0, "Rascunho confirmado nao foi removido.");

let itemAttempt = 0;
const partialCalls = [];
const partialState = createWordImportState([{ number: "WORD-PARTIAL", items: [
  { description: "Item A", quantity: "1", unit: "UN" },
  { description: "Item B", quantity: "2", unit: "KG" },
] }]);
const partialApi = {
  saveOpportunities: async () => { putCalls += 1; },
  createOpportunity: async () => { partialCalls.push(["op"]); return { data: { id: "partial-op" } }; },
  createOpportunityItem: async (_id, payload) => {
    itemAttempt += 1;
    if (itemAttempt === 2) throw new TypeError("offline");
    partialCalls.push(["item", payload.description]);
    return { data: {} };
  },
};
try {
  await importWordGranular(partialApi, partialState);
} catch (error) {
  assert(error.importState.opportunities[0].remoteOpportunityId === "partial-op", "Estado parcial da importacao nao foi preservado.");
}
partialApi.createOpportunityItem = async (_id, payload) => { partialCalls.push(["item", payload.description]); return { data: {} }; };
await importWordGranular(partialApi, partialState);
assert(partialCalls.filter(([type]) => type === "op").length === 1, "Reconexao duplicou a oportunidade importada.");
assert(partialCalls.filter(([type]) => type === "item").length === 2, "Reconexao perdeu ou duplicou itens importados.");
assert(putCalls === 0, "Importacao Word chamou o PUT integral.");
assert(opportunities.length === 3, "Operacoes de teste alteraram oportunidades nao relacionadas.");

console.log("Opportunity management OK.");
