import { checkBackendAndSync } from "../src/services/backendConnection.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let flushCount = 0;
const onlineResult = await checkBackendAndSync({
  async health() {
    return { status: "ok" };
  },
  async flushPendingSync() {
    flushCount += 1;
    return { synchronized: 2, failed: 0, pending: 0 };
  },
  pendingSyncCount() {
    return 0;
  },
});

assert(onlineResult.status === "online", "O backend saudavel deveria ser marcado como online.");
assert(onlineResult.sync.synchronized === 2, "O resultado deveria informar as escritas sincronizadas.");
assert(flushCount === 1, "A fila deveria ser processada uma unica vez.");

let offlineFlushCount = 0;
const offlineResult = await checkBackendAndSync({
  async health() {
    throw new Error("offline");
  },
  async flushPendingSync() {
    offlineFlushCount += 1;
  },
  pendingSyncCount() {
    return 3;
  },
});

assert(offlineResult.status === "offline", "Falha na saude deveria marcar o backend como offline.");
assert(offlineResult.sync.pending === 3, "As pendencias deveriam permanecer visiveis offline.");
assert(offlineFlushCount === 0, "A fila nao deveria ser processada sem conexao.");

console.log("Backend connection OK.");
