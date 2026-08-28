import { loadOpportunitiesWithFallback } from "../src/services/opportunitySync.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createLocalStore(initial = []) {
  let data = initial;
  return {
    listAll: () => data,
    saveAll(opportunities) { data = opportunities; },
    current: () => data,
  };
}

const remoteData = [{ id: "remote-1", number: "7001", items: [] }];
const remoteStore = createLocalStore([{ id: "local-1", number: "6001", items: [] }]);
const remoteResult = await loadOpportunitiesWithFallback({
  api: {
    opportunities: async (options) => {
      assert(options.includeArchived === true, "A consulta deve incluir oportunidades arquivadas.");
      return { data: remoteData };
    },
  },
  localStore: remoteStore,
});
assert(remoteResult.source === "sqlite", "O SQLite deveria ser a fonte oficial online.");
assert(remoteStore.current() === remoteData, "O cache deveria espelhar o SQLite.");

const legacyData = [{ id: "legacy-1", number: "7002", items: [{ id: "legacy-item" }] }];
const emptyRemoteStore = createLocalStore(legacyData);
let preservedLegacy = null;
const emptyResult = await loadOpportunitiesWithFallback({
  api: {
    opportunities: async () => ({ data: [] }),
    saveOpportunities: async () => { throw new Error("O PUT legado nunca deve ser chamado."); },
  },
  localStore: emptyRemoteStore,
  draftStore: { preserveLegacyImport(opportunities) { preservedLegacy = opportunities; } },
});
assert(emptyResult.source === "sqlite" && emptyResult.opportunities.length === 0, "SQLite vazio continua oficial.");
assert(preservedLegacy === legacyData, "Dados locais anteriores deveriam virar rascunho confirmado pelo usuario.");
assert(emptyRemoteStore.current().length === 0, "Cache deveria refletir o SQLite vazio.");

const fallbackData = [{ id: "local-3", number: "7003", items: [] }];
const fallbackStore = createLocalStore(fallbackData);
const fallbackResult = await loadOpportunitiesWithFallback({
  api: { opportunities: async () => { throw new Error("offline"); } },
  localStore: fallbackStore,
});
assert(fallbackResult.source === "local", "Sem backend, a fonte deveria ser o cache de consulta.");
assert(fallbackResult.opportunities === fallbackData, "O fallback nao deve alterar o cache.");

console.log("Opportunity sync OK.");
