import {
  enqueueRequest,
  flushPendingSyncRequests,
  getPendingSyncCount,
} from "./syncQueue";

const API_BASE_URL = "http://127.0.0.1:3333";

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
    const error = new Error(data?.message || `Erro HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function shouldQueue(error) {
  return !Number.isFinite(error?.status) || error.status >= 500;
}

async function queuedRequest(path, options = {}) {
  try {
    return await requestJson(path, options);
  } catch (error) {
    if (!shouldQueue(error)) throw error;

    enqueueRequest({
      path,
      method: options.method,
      headers: options.headers,
      body: options.body,
    });
    const pendingError = new Error("Backend indisponivel. Alteracao adicionada a fila de sincronizacao.");
    pendingError.code = "sync_pending";
    throw pendingError;
  }
}

export const backendApi = {
  health() {
    return requestJson("/health");
  },

  opportunities({ includeArchived = false } = {}) {
    const query = includeArchived ? "?includeArchived=true" : "";
    return requestJson(`/api/opportunities${query}`);
  },

  saveOpportunities(opportunities) {
    return queuedRequest("/api/opportunities", {
      method: "PUT",
      body: JSON.stringify({ opportunities }),
    });
  },

  updateOpportunityItemQuotationStatus({ opportunityId, itemId, status }) {
    return queuedRequest(
      `/api/opportunities/${encodeURIComponent(opportunityId)}/items/${encodeURIComponent(itemId)}/quotation-status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    );
  },

  suppliers({ includeArchived = false } = {}) {
    const query = includeArchived ? "?includeArchived=true" : "";
    return requestJson(`/api/suppliers${query}`);
  },

  saveSupplier(supplier, { isNew = false } = {}) {
    const isUpdate = Boolean(supplier.id) && !isNew;

    return queuedRequest(isUpdate ? `/api/suppliers/${encodeURIComponent(supplier.id)}` : "/api/suppliers", {
      method: isUpdate ? "PUT" : "POST",
      body: JSON.stringify(supplier),
    });
  },

  deleteSupplier(id) {
    return queuedRequest(`/api/suppliers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  quotations({ includeArchived = false } = {}) {
    const query = includeArchived ? "?includeArchived=true" : "";
    return requestJson(`/api/quotations${query}`);
  },

  saveQuotation(quotation, { isNew = false } = {}) {
    const isUpdate = Boolean(quotation.id) && !isNew;

    return queuedRequest(isUpdate ? `/api/quotations/${encodeURIComponent(quotation.id)}` : "/api/quotations", {
      method: isUpdate ? "PUT" : "POST",
      body: JSON.stringify(quotation),
    });
  },

  deleteQuotation(id) {
    return queuedRequest(`/api/quotations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  proposals({ includeArchived = false } = {}) {
    const query = includeArchived ? "?includeArchived=true" : "";
    return requestJson(`/api/proposals${query}`);
  },

  saveProposal(proposal, { isNew = false } = {}) {
    const isUpdate = Boolean(proposal.id) && !isNew;

    return queuedRequest(isUpdate ? `/api/proposals/${encodeURIComponent(proposal.id)}` : "/api/proposals", {
      method: isUpdate ? "PUT" : "POST",
      body: JSON.stringify(proposal),
    });
  },

  deleteProposal(id) {
    return queuedRequest(`/api/proposals/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  summary() {
    return requestJson("/api/summary");
  },

  importBackup(backup) {
    return requestJson("/api/import-backup", {
      method: "POST",
      body: JSON.stringify(backup),
    });
  },

  exportBackup() {
    return requestJson("/api/export-backup");
  },

  pendingSyncCount() {
    return getPendingSyncCount();
  },

  flushPendingSync() {
    return flushPendingSyncRequests(requestJson);
  },
};
