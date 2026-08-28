import http from "node:http";
import {
  exportBackup,
  getDatabaseSummary,
  importBackup,
  initializeDatabase,
  listOpportunities,
  listProposals,
  listQuotations,
  listSuppliers,
  replaceOpportunities,
  archiveProposal,
  archiveSupplier,
  archiveQuotation,
  saveProposal,
  saveSupplier,
  saveQuotation,
  updateOpportunityItemQuotationStatus,
} from "./database.js";
import {
  ApiError,
  archiveGranularItem,
  archiveGranularOpportunity,
  createGranularItem,
  createGranularOpportunity,
  getGranularItem,
  getGranularOpportunity,
  listGranularItems,
  restoreGranularItem,
  restoreGranularOpportunity,
  updateGranularItem,
  updateGranularOpportunity,
} from "./opportunity-api.js";

const PORT = Number(process.env.PORT || 3333);
const ALLOWED_ORIGINS = new Set(
  (process.env.LICITA_AI_ALLOWED_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const database = initializeDatabase();

const routes = [
  {
    method: "GET",
    path: "/health",
    handler() {
      return {
        status: 200,
        body: {
          status: "ok",
          service: "licita-ai-backend",
          storage: "sqlite",
        },
      };
    },
  },
  {
    method: "GET",
    path: "/api",
    handler() {
      return {
        status: 200,
        body: {
          name: "LICITA AI API",
          version: "0.1.0",
          resources: [
            "/api/opportunities",
            "POST /api/opportunities",
            "GET|PATCH /api/opportunities/:opportunityId",
            "POST /api/opportunities/:opportunityId/archive|restore",
            "GET|POST /api/opportunities/:opportunityId/items",
            "GET|PATCH /api/opportunities/:opportunityId/items/:itemId",
            "POST /api/opportunities/:opportunityId/items/:itemId/archive|restore",
            "PUT /api/opportunities (obsoleto; compatibilidade temporaria)",
            "PATCH /api/opportunities/:opportunityId/items/:itemId/quotation-status",
            "/api/suppliers",
            "POST /api/suppliers",
            "PUT /api/suppliers/:id",
            "DELETE /api/suppliers/:id",
            "/api/quotations",
            "POST /api/quotations",
            "PUT /api/quotations/:id",
            "DELETE /api/quotations/:id",
            "/api/proposals",
            "POST /api/proposals",
            "PUT /api/proposals/:id",
            "DELETE /api/proposals/:id",
            "/api/summary",
            "/api/export-backup",
            "POST /api/import-backup",
          ],
          note: "Rotas iniciais de leitura conectadas ao SQLite.",
        },
      };
    },
  },
  {
    method: "GET",
    path: "/api/opportunities",
    handler({ url }) {
      return {
        status: 200,
        body: {
          data: listOpportunities(database, {
            includeArchived: includeArchivedFrom(url),
          }),
        },
      };
    },
  },
  {
    method: "POST",
    path: "/api/opportunities",
    async handler({ request, url }) {
      assertNoQuery(url);
      return { status: 201, body: { data: createGranularOpportunity(database, await readJsonBody(request)) } };
    },
  },
  {
    method: "PUT",
    path: "/api/opportunities",
    async handler({ request }) {
      const data = await readJsonBody(request);
      const opportunities = replaceOpportunities(database, data.opportunities || data);

      return {
        status: 200,
        body: {
          data: opportunities,
          meta: {
            deprecated: true,
            message: "Use os endpoints granulares de oportunidades e itens.",
          },
        },
      };
    },
  },
  {
    method: "GET",
    path: "/api/suppliers",
    handler({ url }) {
      return {
        status: 200,
        body: {
          data: listSuppliers(database, {
            includeArchived: url.searchParams.get("includeArchived") === "true",
          }),
        },
      };
    },
  },
  {
    method: "POST",
    path: "/api/suppliers",
    async handler({ request }) {
      const data = await readJsonBody(request);
      const supplier = saveSupplier(database, data);

      return {
        status: 201,
        body: {
          data: supplier,
        },
      };
    },
  },
  {
    method: "GET",
    path: "/api/quotations",
    handler({ url }) {
      return {
        status: 200,
        body: {
          data: listQuotations(database, {
            includeArchived: url.searchParams.get("includeArchived") === "true",
          }),
        },
      };
    },
  },
  {
    method: "POST",
    path: "/api/quotations",
    async handler({ request }) {
      const data = await readJsonBody(request);
      const quotation = saveQuotation(database, data);

      return {
        status: 201,
        body: {
          data: quotation,
        },
      };
    },
  },
  {
    method: "GET",
    path: "/api/summary",
    handler() {
      return {
        status: 200,
        body: {
          data: getDatabaseSummary(database),
        },
      };
    },
  },
  {
    method: "GET",
    path: "/api/export-backup",
    handler() {
      return {
        status: 200,
        body: {
          data: exportBackup(database),
        },
      };
    },
  },
  {
    method: "POST",
    path: "/api/import-backup",
    async handler({ request }) {
      const data = await readJsonBody(request);
      const summary = importBackup(database, data);

      return {
        status: 200,
        body: {
          message: "Backup importado para o SQLite.",
          data: summary,
        },
      };
    },
  },
  {
    method: "GET",
    path: "/api/proposals",
    handler({ url }) {
      return {
        status: 200,
        body: {
          data: listProposals(database, {
            includeArchived: url.searchParams.get("includeArchived") === "true",
          }),
        },
      };
    },
  },
  {
    method: "POST",
    path: "/api/proposals",
    async handler({ request }) {
      const data = await readJsonBody(request);
      const proposal = saveProposal(database, data);

      return {
        status: 201,
        body: {
          data: proposal,
        },
      };
    },
  },
];

function includeArchivedFrom(url) {
  for (const key of url.searchParams.keys()) {
    if (key !== "includeArchived") {
      throw new ApiError(422, "validation_error", "Parametro de consulta nao permitido.", {
        field: key,
      });
    }
  }
  const value = url.searchParams.get("includeArchived");
  if (value !== null && value !== "true" && value !== "false") {
    throw new ApiError(422, "validation_error", "includeArchived deve ser true ou false.", {
      field: "includeArchived",
    });
  }
  return value === "true";
}

function assertNoQuery(url) {
  const first = url.searchParams.keys().next();
  if (!first.done) {
    throw new ApiError(422, "validation_error", "Esta operacao nao aceita parametros de consulta.", {
      field: first.value,
    });
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function sendApiError(response, error) {
  if (error instanceof ApiError) {
    sendJson(response, error.status, {
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }
  if (error?.code?.startsWith("SQLITE_CONSTRAINT") || /UNIQUE constraint failed/i.test(error?.message || "")) {
    sendJson(response, 409, {
      error: { code: "duplicate", message: "Registro duplicado ou relacionamento invalido." },
    });
    return;
  }
  sendJson(response, 400, {
    error: { code: "bad_request", message: error?.message || "Nao foi possivel processar a requisicao." },
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const mediaType = request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") {
      reject(new ApiError(415, "unsupported_media_type", "Content-Type deve ser application/json."));
      return;
    }
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 10 * 1024 * 1024) {
        reject(new ApiError(413, "payload_too_large", "Payload muito grande."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new ApiError(400, "invalid_json", "JSON invalido."));
      }
    });

    request.on("error", reject);
  });
}

async function handleGranularOpportunityRequest(request, response, url) {
  const opportunityMatch = url.pathname.match(/^\/api\/opportunities\/([^/]+)$/);
  const opportunityActionMatch = url.pathname.match(/^\/api\/opportunities\/([^/]+)\/(archive|restore)$/);
  const itemsMatch = url.pathname.match(/^\/api\/opportunities\/([^/]+)\/items$/);
  const itemMatch = url.pathname.match(/^\/api\/opportunities\/([^/]+)\/items\/([^/]+)$/);
  const itemActionMatch = url.pathname.match(
    /^\/api\/opportunities\/([^/]+)\/items\/([^/]+)\/(archive|restore)$/
  );

  const matched = opportunityMatch || opportunityActionMatch || itemsMatch || itemMatch || itemActionMatch;
  if (!matched) return false;

  try {
    if (opportunityMatch && request.method === "GET") {
      const id = decodeURIComponent(opportunityMatch[1]);
      sendJson(response, 200, {
        data: getGranularOpportunity(database, id, { includeArchived: includeArchivedFrom(url) }),
      });
      return true;
    }
    if (opportunityMatch && request.method === "PATCH") {
      assertNoQuery(url);
      const id = decodeURIComponent(opportunityMatch[1]);
      sendJson(response, 200, {
        data: updateGranularOpportunity(database, id, await readJsonBody(request)),
      });
      return true;
    }
    if (opportunityActionMatch && request.method === "POST") {
      assertNoQuery(url);
      const id = decodeURIComponent(opportunityActionMatch[1]);
      const operation = opportunityActionMatch[2] === "archive"
        ? archiveGranularOpportunity
        : restoreGranularOpportunity;
      sendJson(response, 200, { data: operation(database, id, await readJsonBody(request)) });
      return true;
    }
    if (itemsMatch && request.method === "GET") {
      const opportunityId = decodeURIComponent(itemsMatch[1]);
      sendJson(response, 200, {
        data: listGranularItems(database, opportunityId, { includeArchived: includeArchivedFrom(url) }),
      });
      return true;
    }
    if (itemsMatch && request.method === "POST") {
      assertNoQuery(url);
      const opportunityId = decodeURIComponent(itemsMatch[1]);
      sendJson(response, 201, {
        data: createGranularItem(database, opportunityId, await readJsonBody(request)),
      });
      return true;
    }
    if (itemMatch && request.method === "GET") {
      const opportunityId = decodeURIComponent(itemMatch[1]);
      const itemId = decodeURIComponent(itemMatch[2]);
      sendJson(response, 200, {
        data: getGranularItem(database, opportunityId, itemId, { includeArchived: includeArchivedFrom(url) }),
      });
      return true;
    }
    if (itemMatch && request.method === "PATCH") {
      assertNoQuery(url);
      const opportunityId = decodeURIComponent(itemMatch[1]);
      const itemId = decodeURIComponent(itemMatch[2]);
      sendJson(response, 200, {
        data: updateGranularItem(database, opportunityId, itemId, await readJsonBody(request)),
      });
      return true;
    }
    if (itemActionMatch && request.method === "POST") {
      assertNoQuery(url);
      const opportunityId = decodeURIComponent(itemActionMatch[1]);
      const itemId = decodeURIComponent(itemActionMatch[2]);
      const operation = itemActionMatch[3] === "archive" ? archiveGranularItem : restoreGranularItem;
      sendJson(response, 200, {
        data: operation(database, opportunityId, itemId, await readJsonBody(request)),
      });
      return true;
    }
  } catch (error) {
    sendApiError(response, error);
    return true;
  }

  sendJson(response, 405, {
    error: { code: "method_not_allowed", message: "Metodo nao permitido para esta rota." },
  });
  return true;
}

async function handleRequest(request, response) {
  const requestOrigin = request.headers.origin;

  if (requestOrigin && !ALLOWED_ORIGINS.has(requestOrigin)) {
    sendJson(response, 403, {
      error: "origin_not_allowed",
      message: "Origem nao autorizada.",
    });
    return;
  }

  if (requestOrigin) {
    response.setHeader("Access-Control-Allow-Origin", requestOrigin);
    response.setHeader("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const route = routes.find((item) => item.method === request.method && item.path === url.pathname);

  if (await handleGranularOpportunityRequest(request, response, url)) return;

  if (request.method === "PUT" && url.pathname.startsWith("/api/suppliers/")) {
    try {
      const id = decodeURIComponent(url.pathname.replace("/api/suppliers/", ""));
      const data = await readJsonBody(request);
      const supplier = saveSupplier(database, { ...data, id });
      sendJson(response, 200, { data: supplier });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error.message || "Nao foi possivel processar a requisicao.",
      });
    }
    return;
  }

  const opportunityItemStatusMatch = url.pathname.match(
    /^\/api\/opportunities\/([^/]+)\/items\/([^/]+)\/quotation-status$/
  );

  if (request.method === "PATCH" && opportunityItemStatusMatch) {
    try {
      const data = await readJsonBody(request);
      const result = updateOpportunityItemQuotationStatus(database, {
        opportunityId: decodeURIComponent(opportunityItemStatusMatch[1]),
        itemId: decodeURIComponent(opportunityItemStatusMatch[2]),
        status: data.status,
      });
      sendJson(response, 200, { data: result });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error.message || "Nao foi possivel processar a requisicao.",
      });
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/suppliers/")) {
    try {
      const id = decodeURIComponent(url.pathname.replace("/api/suppliers/", ""));
      const result = archiveSupplier(database, id);
      sendJson(response, 200, { data: result });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error.message || "Nao foi possivel processar a requisicao.",
      });
    }
    return;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/quotations/")) {
    try {
      const id = decodeURIComponent(url.pathname.replace("/api/quotations/", ""));
      const data = await readJsonBody(request);
      const quotation = saveQuotation(database, { ...data, id });
      sendJson(response, 200, { data: quotation });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error.message || "Nao foi possivel processar a requisicao.",
      });
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/quotations/")) {
    try {
      const id = decodeURIComponent(url.pathname.replace("/api/quotations/", ""));
      const result = archiveQuotation(database, id);
      sendJson(response, 200, { data: result });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error.message || "Nao foi possivel processar a requisicao.",
      });
    }
    return;
  }

  if (request.method === "PUT" && url.pathname.startsWith("/api/proposals/")) {
    try {
      const id = decodeURIComponent(url.pathname.replace("/api/proposals/", ""));
      const data = await readJsonBody(request);
      const proposal = saveProposal(database, { ...data, id });
      sendJson(response, 200, { data: proposal });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error.message || "Nao foi possivel processar a requisicao.",
      });
    }
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/proposals/")) {
    try {
      const id = decodeURIComponent(url.pathname.replace("/api/proposals/", ""));
      const result = archiveProposal(database, id);
      sendJson(response, 200, { data: result });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error.message || "Nao foi possivel processar a requisicao.",
      });
    }
    return;
  }

  if (!route) {
    sendJson(response, 404, {
      error: "not_found",
      message: "Rota nao encontrada.",
    });
    return;
  }

  try {
    const result = await route.handler({ request, url });
    sendJson(response, result.status, result.body);
  } catch (error) {
    sendApiError(response, error);
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`LICITA AI backend running at http://127.0.0.1:${PORT}`);
});
