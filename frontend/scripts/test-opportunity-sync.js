import { loadOpportunitiesWithFallback } from "../src/services/opportunitySync.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createLocalStore(initial = []) {
  let data = initial;

  return {
    listAll() {
      return data;
    },
    saveAll(opportunities) {
      data = opportunities;
    },
    current() {
      return data;
    },
  };
}

const remoteData = [{ id: "remote-1", number: "7001", items: [] }];
const remoteStore = createLocalStore([{ id: "local-1", number: "6001", items: [] }]);
const remoteResult = await loadOpportunitiesWithFallback({
  api: {
    async opportunities() {
      return { data: remoteData };
    },
    async saveOpportunities() {
      throw new Error("Nao deveria migrar quando o SQLite ja possui dados.");
    },
  },
  localStore: remoteStore,
});

assert(remoteResult.source === "sqlite", "O SQLite deveria ser a fonte quando possui dados.");
assert(remoteStore.current() === remoteData, "A copia local deveria receber os dados do SQLite.");

const localData = [{ id: "local-2", number: "7002", items: [{ id: "item-1" }] }];
const migrationStore = createLocalStore(localData);
let migratedPayload = null;
const migrationResult = await loadOpportunitiesWithFallback({
  api: {
    async opportunities() {
      return { data: [] };
    },
    async saveOpportunities(opportunities) {
      migratedPayload = opportunities;
      return { data: opportunities };
    },
  },
  localStore: migrationStore,
});

assert(migratedPayload === localData, "Os dados locais deveriam ser enviados ao SQLite vazio.");
assert(migrationResult.source === "sqlite", "A fonte deveria mudar para SQLite apos a migracao.");
assert(migrationResult.opportunities[0].items.length === 1, "Os itens deveriam ser preservados na migracao.");

const fallbackData = [{ id: "local-3", number: "7003", items: [] }];
const fallbackStore = createLocalStore(fallbackData);
const fallbackResult = await loadOpportunitiesWithFallback({
  api: {
    async opportunities() {
      throw new Error("offline");
    },
  },
  localStore: fallbackStore,
});

assert(fallbackResult.source === "local", "A fonte local deveria ser mantida sem backend.");
assert(fallbackResult.opportunities === fallbackData, "O fallback nao deveria alterar os dados locais.");

console.log("Opportunity sync OK.");
