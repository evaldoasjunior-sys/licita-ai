import {
  clearDatabase,
  createId,
  exportDatabase,
  getOpportunities,
  getProposals,
  getQuotations,
  getSuppliers,
  importDatabase,
  normalizeText,
  PROPOSAL_STATUSES,
  QUOTATION_STATUSES,
  saveOpportunities,
  saveProposals,
  saveQuotations,
  saveSuppliers,
} from "../storage/database";

export { createId, normalizeText, PROPOSAL_STATUSES, QUOTATION_STATUSES };

export const opportunityService = {
  listActive() {
    return getOpportunities();
  },

  listAll() {
    return getOpportunities({ includeArchived: true });
  },

  saveAll(opportunities) {
    saveOpportunities(opportunities);
  },

  updateItemQuotationStatus({ opportunityId, itemId, status }) {
    const now = new Date().toISOString();
    const opportunities = getOpportunities({ includeArchived: true }).map((opportunity) => {
      if (opportunity.id !== opportunityId) return opportunity;

      return {
        ...opportunity,
        updatedAt: now,
        items: opportunity.items.map((item) =>
          item.id === itemId ? { ...item, quotationStatus: status, updatedAt: now } : item
        ),
      };
    });

    saveOpportunities(opportunities);
  },
};

export const supplierService = {
  listActive() {
    return getSuppliers();
  },

  listAll() {
    return getSuppliers({ includeArchived: true });
  },

  saveAll(suppliers) {
    saveSuppliers(suppliers);
  },
};

export const quotationService = {
  listActive() {
    return getQuotations();
  },

  listAll() {
    return getQuotations({ includeArchived: true });
  },

  findById(id) {
    return getQuotations().find((quotation) => quotation.id === id) || null;
  },

  saveAll(quotations) {
    saveQuotations(quotations);
  },

  update(quotationToUpdate) {
    let updatedQuotation = null;
    const quotations = getQuotations({ includeArchived: true }).map((quotation) => {
      if (quotation.id !== quotationToUpdate.id) return quotation;

      updatedQuotation = {
        ...quotation,
        ...quotationToUpdate,
        updatedAt: new Date().toISOString(),
      };

      return updatedQuotation;
    });

    saveQuotations(quotations);
    return updatedQuotation;
  },
};

export const proposalService = {
  listActive() {
    return getProposals();
  },

  listAll() {
    return getProposals({ includeArchived: true });
  },

  findById(id) {
    return getProposals().find((proposal) => proposal.id === id) || null;
  },

  saveAll(proposals) {
    saveProposals(proposals);
  },

  hasActiveForQuotation(quotationId) {
    return getProposals({ includeArchived: true }).some(
      (proposal) =>
        !proposal.archivedAt && proposal.items.some((item) => item.quotationId === quotationId)
    );
  },
};

export const backupService = {
  export() {
    return exportDatabase();
  },

  import(data) {
    importDatabase(data);
  },

  clear() {
    clearDatabase();
  },

  summary() {
    const opportunities = getOpportunities({ includeArchived: true });
    const suppliers = getSuppliers({ includeArchived: true });
    const quotations = getQuotations({ includeArchived: true });
    const proposals = getProposals({ includeArchived: true });

    return [
      ["Oportunidades", opportunities.length],
      ["Fornecedores", suppliers.length],
      ["Cotacoes", quotations.length],
      ["Propostas", proposals.length],
      ["Oportunidades arquivadas", opportunities.filter((item) => item.archivedAt).length],
      ["Fornecedores excluidos", suppliers.filter((item) => item.archivedAt).length],
      ["Cotacoes arquivadas", quotations.filter((item) => item.archivedAt).length],
      ["Propostas arquivadas", proposals.filter((item) => item.archivedAt).length],
    ];
  },
};
