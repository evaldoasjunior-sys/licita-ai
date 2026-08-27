import {
  clearPendingSyncRequests,
  enqueueRequest,
  flushPendingSyncRequests,
  getPendingSyncCount,
} from "../src/services/syncQueue.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MemoryStorage {
  data = new Map();

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
clearPendingSyncRequests();

enqueueRequest({
  path: "/api/suppliers/supplier_1",
  method: "PUT",
  body: JSON.stringify({ id: "supplier_1", name: "Versao 1" }),
});
enqueueRequest({
  path: "/api/suppliers/supplier_1",
  method: "PUT",
  body: JSON.stringify({ id: "supplier_1", name: "Versao 2" }),
});
assert(getPendingSyncCount() === 1, "Escritas equivalentes deveriam ser consolidadas.");

enqueueRequest({ path: "/api/suppliers/supplier_1", method: "DELETE" });
assert(getPendingSyncCount() === 2, "Operacoes diferentes devem preservar a ordem da fila.");

const executed = [];
const successfulFlush = await flushPendingSyncRequests(async (path, options) => {
  executed.push([options.method, path, options.body]);
});

assert(successfulFlush.synchronized === 2, "Duas operacoes deveriam ter sido sincronizadas.");
assert(getPendingSyncCount() === 0, "A fila deveria estar vazia apos sucesso.");
assert(JSON.parse(executed[0][2]).name === "Versao 2", "A fila deveria manter apenas a versao mais recente.");

enqueueRequest({ path: "/api/quotations/quotation_1", method: "DELETE" });
const failedFlush = await flushPendingSyncRequests(async () => {
  throw new Error("Backend offline");
});

assert(failedFlush.failed === 1, "A falha de sincronizacao deveria ser registrada.");
assert(getPendingSyncCount() === 1, "Operacao com falha deve permanecer na fila.");

clearPendingSyncRequests();
delete globalThis.localStorage;

console.log("Sync queue OK.");
