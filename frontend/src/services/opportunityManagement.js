import { normalizeText } from "../storage/database.js";

export const OPPORTUNITY_DRAFTS_KEY = "licita-ai:opportunity-drafts:v1";

function draftId() {
  return `opportunity_draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseStored(storage) {
  try {
    const value = JSON.parse(storage.getItem(OPPORTUNITY_DRAFTS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function createOpportunityDraftStore(storage) {
  return {
    list() {
      return parseStored(storage);
    },
    save(draft) {
      const current = parseStored(storage);
      const value = {
        ...draft,
        id: draft.id || draftId(),
        createdAt: draft.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const next = [...current.filter((item) => item.id !== value.id), value];
      storage.setItem(OPPORTUNITY_DRAFTS_KEY, JSON.stringify(next));
      return value;
    },
    remove(id) {
      storage.setItem(OPPORTUNITY_DRAFTS_KEY, JSON.stringify(parseStored(storage).filter((item) => item.id !== id)));
    },
    preserveLegacyImport(opportunities) {
      const current = parseStored(storage);
      if (current.some((item) => item.type === "legacy-import")) return;
      this.save({ type: "legacy-import", payload: createWordImportState(opportunities), reason: "pending_confirmation" });
    },
  };
}

function text(value) {
  return String(value ?? "").trim();
}

export function validateOpportunityForm(form) {
  const errors = {};
  if (!text(form.number)) errors.number = "Informe o numero da oportunidade.";
  if (text(form.number).length > 100) errors.number = "Use no maximo 100 caracteres.";
  if (text(form.title).length > 500) errors.title = "Use no maximo 500 caracteres.";
  if (text(form.dueDate).length > 50) errors.dueDate = "Use no maximo 50 caracteres.";
  if (text(form.status).length > 100) errors.status = "Use no maximo 100 caracteres.";
  return errors;
}

export function validateItemForm(form) {
  const errors = {};
  if (!text(form.description)) errors.description = "Informe a descricao completa.";
  if (!text(form.quantity)) errors.quantity = "Informe a quantidade.";
  if (!/^\d+(?:[.,]\d+)?$/.test(text(form.quantity)) || Number(text(form.quantity).replace(",", ".")) <= 0) {
    errors.quantity = "Informe uma quantidade numerica positiva.";
  }
  if (!text(form.unit)) errors.unit = "Informe a unidade de medida.";
  const limits = {
    itemNumber: 50,
    description: 10000,
    quantity: 50,
    unit: 50,
    reference: 500,
    manufacturer: 500,
    deliveryLocation: 1000,
    deliveryDeadline: 500,
    technicalNotes: 10000,
  };
  Object.entries(limits).forEach(([field, limit]) => {
    if (text(form[field]).length > limit) errors[field] = `Use no maximo ${limit} caracteres.`;
  });
  return errors;
}

export function opportunityPayload(form, { editing = false } = {}) {
  return {
    number: text(form.number),
    title: text(form.title) || null,
    dueDate: text(form.dueDate) || null,
    status: text(form.status) || "Nao analisada",
    ...(editing ? { version: Number(form.version) } : {}),
  };
}

export function itemPayload(form, { editing = false } = {}) {
  return {
    itemNumber: text(form.itemNumber) || null,
    description: text(form.description),
    quantity: text(form.quantity),
    unit: text(form.unit),
    reference: text(form.reference) || null,
    manufacturer: text(form.manufacturer) || null,
    deliveryLocation: text(form.deliveryLocation) || null,
    deliveryDeadline: text(form.deliveryDeadline) || null,
    technicalNotes: text(form.technicalNotes) || null,
    ...(editing ? { version: Number(form.version) } : {}),
  };
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = br ? new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00`) : new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function filterOpportunities(opportunities, filters, now = new Date()) {
  const query = normalizeText(filters.search);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return opportunities.filter((opportunity) => {
    if (Boolean(opportunity.archivedAt) !== Boolean(filters.archived)) return false;
    if (filters.status && filters.status !== "all" && opportunity.status !== filters.status) return false;
    const due = parseDate(opportunity.dueDate);
    if (filters.deadline === "overdue" && (!due || due >= start)) return false;
    if (filters.deadline === "no-date" && due) return false;
    if (["7", "30"].includes(filters.deadline)) {
      const end = new Date(start);
      end.setDate(end.getDate() + Number(filters.deadline));
      if (!due || due < start || due > end) return false;
    }
    if (!query) return true;
    const itemText = (opportunity.items || [])
      .map((item) => [item.description, item.rawDescription, item.reference, item.manufacturer].join(" "))
      .join(" ");
    return normalizeText([opportunity.number, opportunity.title, itemText].join(" ")).includes(query);
  });
}

export function friendlyOpportunityError(error) {
  if (error?.code === "unit_review_required") {
    return "Unidade não identificada. Informe a unidade dos itens destacados antes de gravar na API.";
  }
  if (error?.code === "validation_error" || error?.status === 422) return error.message || "Revise os campos informados.";
  if (error?.code === "duplicate") return "Ja existe uma oportunidade ativa com este numero.";
  if (error?.code === "conflict" || error?.status === 409) return "Os dados foram alterados em outra sessao. O rascunho foi preservado.";
  if (!Number.isFinite(error?.status) || error?.status >= 500) return "Backend indisponivel. O rascunho foi preservado para nova tentativa.";
  if (error?.code === "not_found" || error?.status === 404) return "O registro nao foi encontrado. Recarregue os dados atuais.";
  return error?.message || "Nao foi possivel concluir a operacao.";
}

export async function executeOpportunityDraft(api, draft) {
  const { payload } = draft;
  switch (draft.type) {
    case "opportunity-create":
      return api.createOpportunity(payload);
    case "opportunity-update":
      return api.updateOpportunity(draft.opportunityId, payload);
    case "opportunity-archive":
      return api.archiveOpportunity(draft.opportunityId, payload.version);
    case "opportunity-restore":
      return api.restoreOpportunity(draft.opportunityId, payload.version);
    case "item-create":
      return api.createOpportunityItem(draft.opportunityId, payload);
    case "item-update":
      return api.updateOpportunityItem(draft.opportunityId, draft.itemId, payload);
    case "item-archive":
      return api.archiveOpportunityItem(draft.opportunityId, draft.itemId, payload.version);
    case "item-restore":
      return api.restoreOpportunityItem(draft.opportunityId, draft.itemId, payload.version);
    case "word-import":
      return importWordGranular(api, payload);
    case "legacy-import":
      return importWordGranular(
        api,
        payload.opportunities?.[0]?.opportunity ? payload : createWordImportState(payload.opportunities || [])
      );
    default:
      throw new Error("Tipo de rascunho desconhecido.");
  }
}

function wordItemPayload(item) {
  const reference = item.reference || item.manufacturerReferences?.flatMap((entry) => entry.codes || []).join(", ");
  const manufacturer = item.manufacturer || item.manufacturers?.map((entry) => entry.name).join(", ");
  const quantityWithUnit = text(item.quantity).match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  const unit = text(item.unit || quantityWithUnit?.[2]);
  return {
    ...itemPayload({
    ...item,
    quantity: quantityWithUnit?.[1] || item.quantity,
    unit,
    reference,
    manufacturer,
    technicalNotes: item.technicalNotes || item.standardizationObservations?.join(" | "),
    }),
    unitReviewRequired: !unit,
    unitConfirmed: Boolean(unit),
  };
}

export function createWordImportState(opportunities) {
  return {
    opportunities: opportunities.map((opportunity) => ({
      opportunity: opportunityPayload(opportunity),
      items: (opportunity.items || []).map(wordItemPayload),
      remoteOpportunityId: null,
      remoteOpportunity: null,
      createdItems: [],
      nextItemIndex: 0,
      completed: false,
    })),
  };
}

export function importItemsWithoutUnit(state) {
  return (state?.opportunities || []).flatMap((entry, opportunityIndex) =>
    (entry.items || [])
      .map((item, itemIndex) => ({ opportunityIndex, itemIndex, item }))
      .filter(
        ({ item, itemIndex }) =>
          itemIndex >= (entry.nextItemIndex || 0) &&
          (!text(item.unit) || (item.unitReviewRequired && !item.unitConfirmed))
      )
  );
}

export function updateImportItemUnit(state, opportunityIndex, itemIndex, unit) {
  return {
    ...state,
    opportunities: (state?.opportunities || []).map((entry, currentOpportunityIndex) =>
      currentOpportunityIndex !== opportunityIndex
        ? entry
        : {
            ...entry,
            items: (entry.items || []).map((item, currentItemIndex) =>
              currentItemIndex === itemIndex ? { ...item, unit: text(unit) } : item
            ),
          }
    ),
  };
}

export function confirmImportItemUnit(state, opportunityIndex, itemIndex) {
  return {
    ...state,
    opportunities: (state?.opportunities || []).map((entry, currentOpportunityIndex) =>
      currentOpportunityIndex !== opportunityIndex
        ? entry
        : {
            ...entry,
            items: (entry.items || []).map((item, currentItemIndex) =>
              currentItemIndex === itemIndex && text(item.unit)
                ? { ...item, unitConfirmed: true }
                : item
            ),
          }
    ),
  };
}

export async function importWordGranular(api, state) {
  if (importItemsWithoutUnit(state).length > 0) {
    const error = new Error("Unidade não identificada.");
    error.code = "unit_review_required";
    error.importState = state;
    throw error;
  }
  for (const entry of state.opportunities) {
    if (entry.completed) continue;
    try {
      if (!entry.remoteOpportunityId) {
        const created = await api.createOpportunity(entry.opportunity);
        entry.remoteOpportunityId = created.data.id;
        entry.remoteOpportunity = created.data;
      }
      while (entry.nextItemIndex < entry.items.length) {
        const createdItem = await api.createOpportunityItem(
          entry.remoteOpportunityId,
          itemPayload(entry.items[entry.nextItemIndex])
        );
        entry.createdItems.push(createdItem.data);
        entry.nextItemIndex += 1;
      }
      entry.completed = true;
    } catch (error) {
      error.importState = state;
      throw error;
    }
  }
  return { data: state };
}
