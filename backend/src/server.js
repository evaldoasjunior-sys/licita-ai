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
            "PUT /api/opportunities",
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
            includeArchived: url.searchParams.get("includeArchived") === "true",
          }),
        },
      };
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

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Payload muito grande."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido."));
      }
    });

    request.on("error", reject);
  });
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
    sendJson(response, 400, {
      error: "bad_request",
      message: error.message || "Nao foi possivel processar a requisicao.",
    });
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`LICITA AI backend running at http://127.0.0.1:${PORT}`);
});
