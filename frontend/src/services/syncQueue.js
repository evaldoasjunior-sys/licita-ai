const STORAGE_KEY = "licita_ai_pending_sync_requests";
const CHANGE_EVENT = "licita-ai-sync-change";

function storage() {
  return globalThis.localStorage || null;
}

function readQueue() {
  try {
    const saved = storage()?.getItem(STORAGE_KEY);
    const queue = saved ? JSON.parse(saved) : [];
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
}

function notifyChange() {
  if (typeof globalThis.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") {
    globalThis.dispatchEvent(new globalThis.CustomEvent(CHANGE_EVENT));
  }
}

function writeQueue(queue) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(queue));
  notifyChange();
}

function bodyResourceId(body) {
  if (!body) return "";
  try {
    return JSON.parse(body)?.id || "";
  } catch {
    return "";
  }
}

function requestIdentity(request) {
  return `${request.method}:${request.path}:${bodyResourceId(request.body)}`;
}

function createQueueId() {
  return globalThis.crypto?.randomUUID?.() || `sync_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function enqueueRequest({ path, method, headers, body }) {
  const now = new Date().toISOString();
  const request = {
    id: createQueueId(),
    path,
    method: method || "POST",
    headers: headers || {},
    body: body || null,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    lastError: "",
  };
  const identity = requestIdentity(request);
  const queue = readQueue();
  const existingIndex = queue.findIndex((item) => requestIdentity(item) === identity);

  if (existingIndex >= 0) {
    request.id = queue[existingIndex].id;
    request.createdAt = queue[existingIndex].createdAt;
    queue[existingIndex] = request;
  } else {
    queue.push(request);
  }

  writeQueue(queue);
  return request;
}

export function getPendingSyncCount() {
  return readQueue().length;
}

export function clearPendingSyncRequests() {
  writeQueue([]);
}

export async function flushPendingSyncRequests(executor) {
  const pending = readQueue();
  let synchronized = 0;
  let failed = 0;

  for (const request of pending) {
    try {
      await executor(request.path, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      writeQueue(readQueue().filter((item) => item.id !== request.id));
      synchronized += 1;
    } catch (error) {
      const queue = readQueue().map((item) =>
        item.id === request.id
          ? {
              ...item,
              attempts: Number(item.attempts || 0) + 1,
              updatedAt: new Date().toISOString(),
              lastError: error?.message || "Falha ao sincronizar.",
            }
          : item
      );
      writeQueue(queue);
      failed += 1;
      break;
    }
  }

  return {
    synchronized,
    failed,
    pending: getPendingSyncCount(),
  };
}

export { CHANGE_EVENT as SYNC_QUEUE_CHANGE_EVENT };
