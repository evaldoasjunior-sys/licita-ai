const KEYS = {
  opportunities: "oportunidades",
  suppliers: "fornecedores",
  quotations: "cotacoes",
  proposals: "propostas",
  currentQuotation: "cotacaoAtual",
};

export const OPPORTUNITY_STATUSES = [
  "Nao analisada",
  "Em analise",
  "Interessante",
  "Cotando",
  "Proposta enviada",
  "Encerrada",
  "Arquivada",
];

export const QUOTATION_STATUSES = [
  "Cotacao gerada",
  "Email enviado",
  "Aguardando resposta",
  "Respondido",
  "Selecionada para proposta",
  "Proposta enviada",
  "Sem retorno",
  "Nao participaremos",
  "Cotado",
  "Pedido emitido",
  "Arquivado",
];

export const PROPOSAL_STATUSES = [
  "Rascunho",
  "Pronta para envio",
  "Enviada na Petronect",
  "Ganha",
  "Perdida",
  "Arquivada",
];

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function text(value, fallback = "") {
  if (value === undefined || value === null) return fallback;

  return String(value)
    .replaceAll("NÃ£o", "Nao")
    .replaceAll("CotaÃ§Ã£o", "Cotacao")
    .replaceAll("CotaÃ§Ãµes", "Cotacoes")
    .replaceAll("DescriÃ§Ã£o", "Descricao")
    .replaceAll("descriÃ§Ã£o", "descricao")
    .replaceAll("VazÃ£o", "Vazao")
    .replaceAll("PressÃ£o", "Pressao")
    .replaceAll("FrequÃªncia", "Frequencia")
    .replaceAll("VÃ¡lvula", "Valvula")
    .replaceAll("VÃLVULA", "VALVULA")
    .replaceAll("PreÃ§o", "Preco")
    .replaceAll("CondiÃ§Ãµes", "Condicoes");
}

function normalizeStatus(value, allowedStatuses, fallback) {
  const current = text(value, fallback);
  const normalizedCurrent = normalizeText(current);
  return (
    allowedStatuses.find((status) => normalizeText(status) === normalizedCurrent) ||
    fallback
  );
}

function migrateManufacturer(value) {
  if (typeof value === "string") {
    return { id: createId("manufacturer"), name: value };
  }

  return {
    id: value?.id || createId("manufacturer"),
    name: text(value?.name || value?.nome),
  };
}

function migrateItem(item) {
  const manufacturers =
    Array.isArray(item?.manufacturers) && item.manufacturers.length > 0
      ? item.manufacturers.map(migrateManufacturer)
      : item?.fabricante
        ? [migrateManufacturer(item.fabricante)]
        : [];

  return {
    id: item?.id || createId("item"),
    itemNumber: text(item?.itemNumber || item?.itemNumero),
    quantity: text(item?.quantity || item?.quantidade),
    unit: text(item?.unit),
    deliveryLocation: text(item?.deliveryLocation || item?.localEntrega || item?.localDeEntrega),
    attachmentRequired: text(item?.attachmentRequired || item?.anexo),
    quotationStatus: text(item?.quotationStatus || item?.statusCotacao),
    description: text(item?.description || item?.descricao),
    rawDescription: text(item?.rawDescription || item?.descricaoOriginal || item?.description || item?.descricao),
    category: text(item?.category || item?.categoria),
    standard: text(item?.standard || item?.norma),
    dimensions: text(item?.dimensions || item?.dimensoes),
    standardizedAttributes: item?.standardizedAttributes || {},
    standardizedSpecifications: Array.isArray(item?.standardizedSpecifications)
      ? item.standardizedSpecifications.map((specification) => text(specification))
      : [],
    standardizationObservations: Array.isArray(item?.standardizationObservations)
      ? item.standardizationObservations.map((observation) => text(observation))
      : [],
    manufacturerReferences: Array.isArray(item?.manufacturerReferences)
      ? item.manufacturerReferences.map((reference) => ({
          manufacturer: text(reference.manufacturer),
          codes: Array.isArray(reference.codes) ? reference.codes.map((code) => text(code)) : [],
          fragment: text(reference.fragment),
        }))
      : [],
    codes: Array.isArray(item?.codes)
      ? item.codes.map((code) => ({
          id: code.id || createId("code"),
          type: text(code.type || code.tipo, "Geral"),
          value: text(code.value || code.valor),
        }))
      : [],
    manufacturers,
    createdAt: item?.createdAt || nowIso(),
    updatedAt: item?.updatedAt || nowIso(),
    archivedAt: item?.archivedAt || null,
  };
}

function migrateOpportunity(opportunity) {
  const createdAt = opportunity?.createdAt || nowIso();

  return {
    id: opportunity?.id || createId("opportunity"),
    sourcePlatform: opportunity?.sourcePlatform || "manual",
    externalId: opportunity?.externalId || null,
    number: text(opportunity?.number || opportunity?.numero),
    title: text(opportunity?.title || opportunity?.titulo),
    dueDate: text(opportunity?.dueDate || opportunity?.vencimento),
    importBatchId: text(opportunity?.importBatchId || opportunity?.loteImportacao),
    importFileName: text(opportunity?.importFileName || opportunity?.arquivoImportacao),
    importedAt: opportunity?.importedAt || "",
    archiveReason: text(opportunity?.archiveReason || opportunity?.motivoArquivamento),
    status: normalizeStatus(opportunity?.status, OPPORTUNITY_STATUSES, OPPORTUNITY_STATUSES[0]),
    rawSnapshot: opportunity?.rawSnapshot || null,
    items: Array.isArray(opportunity?.items)
      ? opportunity.items.map(migrateItem)
      : Array.isArray(opportunity?.itens)
        ? opportunity.itens.map(migrateItem)
        : [],
    createdAt,
    updatedAt: opportunity?.updatedAt || createdAt,
    archivedAt: opportunity?.archivedAt || null,
  };
}

function migrateSpecialty(specialty) {
  return {
    id: specialty?.id || createId("specialty"),
    manufacturer: text(specialty?.manufacturer || specialty?.fabricante),
    category: text(specialty?.category || specialty?.categoria),
    notes: text(specialty?.notes || specialty?.observacoes),
  };
}

function migrateSupplier(supplier) {
  const createdAt = supplier?.createdAt || nowIso();

  return {
    id: supplier?.id || createId("supplier"),
    name: text(supplier?.name || supplier?.nome),
    legalName: text(supplier?.legalName || supplier?.razaoSocial),
    taxId: text(supplier?.taxId || supplier?.cnpj),
    email: text(supplier?.email),
    phone: text(supplier?.phone || supplier?.telefone),
    status: text(supplier?.status, "Ativo"),
    notes: text(supplier?.notes || supplier?.observacoes),
    specialties: Array.isArray(supplier?.specialties)
      ? supplier.specialties.map(migrateSpecialty)
      : Array.isArray(supplier?.especialidades)
        ? supplier.especialidades.map(migrateSpecialty)
        : [],
    createdAt,
    updatedAt: supplier?.updatedAt || createdAt,
    archivedAt: supplier?.archivedAt || null,
  };
}

function migrateQuotation(quotation) {
  const createdAt = quotation?.createdAt || nowIso();

  return {
    id: quotation?.id || createId("quotation"),
    opportunityId: quotation?.opportunityId || null,
    opportunityNumber: text(quotation?.opportunityNumber || quotation?.oportunidade),
    itemId: quotation?.itemId || null,
    itemNumber: text(quotation?.itemNumber || quotation?.item),
    supplierId: quotation?.supplierId || null,
    supplierName: text(quotation?.supplierName || quotation?.fornecedor),
    email: text(quotation?.email),
    description: text(quotation?.description || quotation?.descricao),
    itemDescription: text(quotation?.itemDescription || quotation?.descricaoItem),
    status: normalizeStatus(quotation?.status, QUOTATION_STATUSES, QUOTATION_STATUSES[0]),
    requestedAt: quotation?.requestedAt || quotation?.data || new Date().toLocaleDateString("pt-BR"),
    emailSentAt: text(quotation?.emailSentAt || quotation?.dataEnvioEmail),
    respondedAt: quotation?.respondedAt || "",
    unitPrice: text(quotation?.unitPrice || quotation?.precoUnitario),
    deliveryDays: text(quotation?.deliveryDays || quotation?.prazoEntrega),
    validityDays: text(quotation?.validityDays || quotation?.validade),
    paymentTerms: text(quotation?.paymentTerms || quotation?.condicaoPagamento),
    freight: text(quotation?.freight || quotation?.frete),
    notes: text(quotation?.notes || quotation?.observacoes),
    createdAt,
    updatedAt: quotation?.updatedAt || createdAt,
    archivedAt: quotation?.archivedAt || null,
  };
}

function migrateProposalItem(item) {
  return {
    id: item?.id || createId("proposal_item"),
    opportunityItemId: item?.opportunityItemId || null,
    itemNumber: text(item?.itemNumber),
    description: text(item?.description),
    quantity: text(item?.quantity),
    unit: text(item?.unit),
    deliveryLocation: text(item?.deliveryLocation || item?.localEntrega || item?.localDeEntrega),
    quotationId: item?.quotationId || null,
    supplierName: text(item?.supplierName),
    costUnitPrice: text(item?.costUnitPrice),
    saleUnitPrice: text(item?.saleUnitPrice),
    marginPercent: text(item?.marginPercent),
    totalSalePrice: text(item?.totalSalePrice),
  };
}

function migrateProposal(proposal) {
  const createdAt = proposal?.createdAt || nowIso();

  return {
    id: proposal?.id || createId("proposal"),
    opportunityId: proposal?.opportunityId || null,
    opportunityNumber: text(proposal?.opportunityNumber),
    version: Number(proposal?.version || 1),
    status: normalizeStatus(proposal?.status, PROPOSAL_STATUSES, PROPOSAL_STATUSES[0]),
    marginPercent: text(proposal?.marginPercent),
    totalValue: text(proposal?.totalValue),
    notes: text(proposal?.notes || proposal?.observacoes),
    items: Array.isArray(proposal?.items)
      ? proposal.items.map(migrateProposalItem)
      : [],
    createdAt,
    updatedAt: proposal?.updatedAt || createdAt,
    archivedAt: proposal?.archivedAt || null,
  };
}

export function getOpportunities({ includeArchived = false } = {}) {
  const opportunities = readJson(KEYS.opportunities, []).map(migrateOpportunity);
  return includeArchived
    ? opportunities
    : opportunities.filter((opportunity) => !opportunity.archivedAt);
}

export function saveOpportunities(opportunities) {
  writeJson(KEYS.opportunities, opportunities.map(migrateOpportunity));
}

export function getSuppliers({ includeArchived = false } = {}) {
  const suppliers = readJson(KEYS.suppliers, []).map(migrateSupplier);
  return includeArchived ? suppliers : suppliers.filter((supplier) => !supplier.archivedAt);
}

export function saveSuppliers(suppliers) {
  writeJson(KEYS.suppliers, suppliers.map(migrateSupplier));
}

export function getQuotations({ includeArchived = false } = {}) {
  const quotations = readJson(KEYS.quotations, []).map(migrateQuotation);
  return includeArchived
    ? quotations
    : quotations.filter((quotation) => !quotation.archivedAt);
}

export function saveQuotations(quotations) {
  writeJson(KEYS.quotations, quotations.map(migrateQuotation));
}

export function getProposals({ includeArchived = false } = {}) {
  const proposals = readJson(KEYS.proposals, []).map(migrateProposal);
  return includeArchived ? proposals : proposals.filter((proposal) => !proposal.archivedAt);
}

export function saveProposals(proposals) {
  writeJson(KEYS.proposals, proposals.map(migrateProposal));
}

export function getCurrentQuotation() {
  return readJson(KEYS.currentQuotation, null);
}

export function saveCurrentQuotation(quotation) {
  writeJson(KEYS.currentQuotation, quotation);
}

export function clearCurrentQuotation() {
  localStorage.removeItem(KEYS.currentQuotation);
}

export function exportDatabase() {
  return {
    version: 1,
    exportedAt: nowIso(),
    opportunities: getOpportunities({ includeArchived: true }),
    suppliers: getSuppliers({ includeArchived: true }),
    quotations: getQuotations({ includeArchived: true }),
    proposals: getProposals({ includeArchived: true }),
  };
}

export function importDatabase(data) {
  saveOpportunities(Array.isArray(data?.opportunities) ? data.opportunities : []);
  saveSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : []);
  saveQuotations(Array.isArray(data?.quotations) ? data.quotations : []);
  saveProposals(Array.isArray(data?.proposals) ? data.proposals : []);
}

export function clearDatabase() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
