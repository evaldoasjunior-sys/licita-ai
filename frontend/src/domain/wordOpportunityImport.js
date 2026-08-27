import JSZip from "jszip";
import { standardizeItemDescription } from "./itemStandardization";
import { createId, normalizeText } from "../storage/database";

const WORD_TABLE_COLUMNS = {
  number: 0,
  item: 1,
  quantity: 2,
  description: 3,
  delivery: 4,
  attachment: 5,
  dueDate: 6,
};

function xmlText(cell) {
  return Array.from(cell.getElementsByTagNameNS("*", "t"))
    .map((node) => node.textContent || "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function rowCells(row) {
  return Array.from(row.getElementsByTagNameNS("*", "tc")).map(xmlText);
}

function isOpportunityHeader(cells) {
  const normalized = cells.map(normalizeText);
  return (
    normalized.some((cell) => cell === "N°" || cell === "N" || cell === "NO") &&
    normalized.includes("ITEM") &&
    normalized.includes("QTDE") &&
    normalized.includes("DESCRICAO")
  );
}

function hasUsefulDescription(row) {
  return Boolean(row.description?.trim() && row.number?.trim());
}

function itemFromWordRow(row) {
  const standardized = standardizeItemDescription(row.description);
  const agora = new Date().toISOString();

  return {
    id: createId("item"),
    itemNumber: row.item || "1",
    quantity: row.quantity,
    unit: "",
    deliveryLocation: row.delivery,
    attachmentRequired: row.attachment,
    description: standardized.normalizedDescription || row.description,
    rawDescription: row.description,
    category: standardized.category,
    standard: standardized.attributes.standard,
    dimensions: "",
    standardizedAttributes: standardized.attributes,
    standardizedSpecifications: standardized.specifications,
    standardizationObservations: standardized.observations,
    manufacturerReferences: standardized.manufacturerReferences,
    quotationStatus: "",
    codes: standardized.codes.map((value) => ({
      id: createId("code"),
      type: "Geral",
      value,
    })),
    manufacturers: standardized.manufacturers.map((name) => ({
      id: createId("manufacturer"),
      name,
    })),
    createdAt: agora,
    updatedAt: agora,
    archivedAt: null,
  };
}

export async function readWordOpportunityRows(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");

  if (!documentXml) {
    throw new Error("Nao foi possivel ler o conteudo do arquivo Word.");
  }

  const document = new DOMParser().parseFromString(documentXml, "application/xml");
  const tables = Array.from(document.getElementsByTagNameNS("*", "tbl"));
  const rows = [];

  tables.forEach((table) => {
    const tableRows = Array.from(table.getElementsByTagNameNS("*", "tr")).map(rowCells);
    const headerIndex = tableRows.findIndex(isOpportunityHeader);

    if (headerIndex < 0) return;

    let currentNumber = "";
    let currentDelivery = "";
    let currentAttachment = "";
    let currentDueDate = "";

    tableRows.slice(headerIndex + 1).forEach((cells) => {
      const number = cells[WORD_TABLE_COLUMNS.number]?.trim() || currentNumber;
      const delivery = cells[WORD_TABLE_COLUMNS.delivery]?.trim() || currentDelivery;
      const attachment = cells[WORD_TABLE_COLUMNS.attachment]?.trim() || currentAttachment;
      const dueDate = cells[WORD_TABLE_COLUMNS.dueDate]?.trim() || currentDueDate;
      const description = cells[WORD_TABLE_COLUMNS.description]?.trim() || "";

      if (cells[WORD_TABLE_COLUMNS.number]?.trim()) currentNumber = cells[WORD_TABLE_COLUMNS.number].trim();
      if (cells[WORD_TABLE_COLUMNS.delivery]?.trim()) currentDelivery = cells[WORD_TABLE_COLUMNS.delivery].trim();
      if (cells[WORD_TABLE_COLUMNS.attachment]?.trim()) currentAttachment = cells[WORD_TABLE_COLUMNS.attachment].trim();
      if (cells[WORD_TABLE_COLUMNS.dueDate]?.trim()) currentDueDate = cells[WORD_TABLE_COLUMNS.dueDate].trim();

      const row = {
        number,
        item: cells[WORD_TABLE_COLUMNS.item]?.trim() || "",
        quantity: cells[WORD_TABLE_COLUMNS.quantity]?.trim() || "",
        description,
        delivery,
        attachment,
        dueDate,
      };

      if (hasUsefulDescription(row)) rows.push(row);
    });
  });

  return rows;
}

export function buildOpportunitiesFromWordRows(rows, fileName, existingOpportunities) {
  const existingNumbers = new Set(existingOpportunities.map((opportunity) => normalizeText(opportunity.number)));
  const grouped = new Map();
  const skippedNumbers = new Set();
  const agora = new Date().toISOString();

  rows.forEach((row) => {
    const normalizedNumber = normalizeText(row.number);

    if (existingNumbers.has(normalizedNumber)) {
      skippedNumbers.add(row.number);
      return;
    }

    if (!grouped.has(row.number)) {
      grouped.set(row.number, {
        id: createId("opportunity"),
        sourcePlatform: "word",
        externalId: row.number,
        number: row.number,
        title: fileName,
        dueDate: row.dueDate,
        status: "Nao analisada",
        rawSnapshot: { fileName },
        items: [],
        createdAt: agora,
        updatedAt: agora,
        archivedAt: null,
      });
    }

    const opportunity = grouped.get(row.number);
    opportunity.dueDate = opportunity.dueDate || row.dueDate;
    opportunity.items.push(itemFromWordRow(row));
  });

  return {
    opportunities: Array.from(grouped.values()),
    skippedNumbers: Array.from(skippedNumbers),
  };
}
