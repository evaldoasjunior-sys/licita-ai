import { normalizeText } from "../storage/database.js";

const KNOWN_MANUFACTURERS = [
  "ABB",
  "AVANT",
  "EMERSON",
  "GE",
  "HELVAR",
  "IDEAL",
  "INTRAL",
  "KALTHERM",
  "KEIKOBRAS",
  "LEDVANCE",
  "LINSA",
  "NIFE",
  "OSRAM",
  "PELCO",
  "PHILIPS",
  "SCHNEIDER",
  "SIEMENS",
  "SKF",
  "SMAR",
  "SYLVANIA",
  "TASCHIBRA",
  "TEKIN",
  "TRIDONIC",
  "VOSSLOH",
  "VOSSLOH-SCHWABE",
  "WEG",
  "YOKOGAWA",
];

const NON_MANUFACTURER_WORDS = [
  "COM",
  "COR",
  "CORPO",
  "DE",
  "EM",
  "IEC",
  "IP",
  "LAMP",
  "LAMPADA",
  "LED",
  "LEDS",
  "NBR",
  "OU",
  "PARA",
  "PROTECAO",
  "REATOR",
  "REFLETOR",
  "SIMPLES",
  "TIPO",
];

const GENERIC_CODE_LABELS = [
  "COD",
  "CODIGO",
  "CODIGOS",
  "MODELO",
  "MODELOS",
  "REF",
  "REFERENCIA",
  "REFERENCIAS",
];

function cleanPart(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.map(cleanPart).filter(Boolean))];
}

function findFirst(text, regex) {
  return text.match(regex)?.[0] || "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCategory(normalizedText) {
  if (
    normalizedText.includes("REATOR") &&
    (normalizedText.includes("LAMPADA") || normalizedText.includes("LAMP"))
  ) {
    return "Reator para Lampada";
  }
  if (normalizedText.includes("REATOR")) return "Reator";
  if (normalizedText.includes("FILTRO EM PAINEL")) return "Filtro em painel";
  if (normalizedText.includes("FILTRO")) return "Filtro";
  if (
    normalizedText.includes("MOTOR") &&
    normalizedText.includes("INDUCAO") &&
    normalizedText.includes("TRIFASICO")
  ) {
    return "Motor eletrico de inducao trifasico";
  }
  if (normalizedText.includes("MOTOR ELETRICO")) return "Motor eletrico";
  if (normalizedText.includes("MOTOR")) return "Motor";
  if (normalizedText.includes("LUMINARIA")) return "Luminaria LED";
  if (normalizedText.includes("SERPENTINA")) return "Serpentina";
  if (
    normalizedText.includes("CONV") &&
    normalizedText.includes("COMUNICACAO")
  ) {
    return "Conversor de comunicacao";
  }
  if (normalizedText.includes("INTERFACES PARA REDE DE DADOS")) return "Interface para rede de dados";
  if (normalizedText.includes("TRANSMISSOR DE VAZAO")) return "Transmissor de Vazao";
  if (normalizedText.includes("TRANSMISSOR DE PRESSAO")) return "Transmissor de Pressao";
  if (normalizedText.includes("TRANSMISSOR DE TEMPERATURA")) return "Transmissor de Temperatura";
  if (normalizedText.includes("ACUMULADOR") && normalizedText.includes("CHUMBO")) {
    return "Acumulador eletrico de chumbo-acido";
  }
  if (normalizedText.includes("ACUMULADOR")) return "Acumulador eletrico";
  if (normalizedText.includes("ROLAMENTO")) return "Rolamento";
  if (normalizedText.includes("CONTATOR")) return "Contator";
  if (normalizedText.includes("INVERSOR")) return "Inversor de Frequencia";
  if (normalizedText.includes("VALVULA")) return "Valvula";
  if (normalizedText.includes("CAIXA") && normalizedText.includes("ARMAZENAGEM")) {
    return "Caixa de armazenagem";
  }

  return "";
}

function inferCategoryFromFirstPart(parts) {
  const firstPart = cleanPart(parts[0] || "");
  const normalizedFirstPart = normalizeText(firstPart);

  if (
    !firstPart ||
    firstPart.length < 4 ||
    /^\d/.test(firstPart) ||
    /^tp\s*:/i.test(firstPart) ||
    /^tipo\s*:/i.test(firstPart) ||
    /^fabricante\s*:/i.test(firstPart) ||
    KNOWN_MANUFACTURERS.includes(normalizedFirstPart)
  ) {
    return "";
  }

  return firstPart;
}

function findSpecifications(parts, attributes) {
  return unique([
    parts.find((part) => normalizeText(part).includes("VAPOR")) || "",
    parts.find((part) => normalizeText(part).includes("ALETADA")) || "",
    parts.find((part) => normalizeText(part).includes("AR CONDICIONADO")) || "",
    parts.find((part) => normalizeText(part).includes("FAN COIL")) || "",
    parts.find((part) => normalizeText(part).includes("ESTACIONARIO")) || "",
    parts.find((part) => normalizeText(part).includes("VENTILADO")) || "",
    parts.find((part) => normalizeText(part).includes("TIPO ARMARIO")) || "",
    parts.find((part) => normalizeText(part).includes("ARMAZENAGEM DE")) || "",
    parts.find((part) => normalizeText(part).includes("10/100MBPS")) || "",
    parts.find((part) => normalizeText(part).includes("RS-485")) || "",
    parts.find((part) => normalizeText(part).includes("CONEXAO USB")) || "",
    parts.find((part) => normalizeText(part).includes("INTERFACES PARA REDE DE DADOS")) || "",
    attributes.range && `Alcance: ${attributes.range}`,
    attributes.dimensions && `Dimensoes: ${attributes.dimensions}`,
    parts.find((part) => normalizeText(part).includes("PRATELEIRAS")) || "",
    attributes.color && `Cor: ${attributes.color}`,
    attributes.power && `Potencia: ${attributes.power}`,
    attributes.voltage && `Tensao: ${attributes.voltage}`,
    attributes.capacity && `Capacidade: ${attributes.capacity}`,
    attributes.dischargeRate && `Regime de descarga: ${attributes.dischargeRate}`,
    attributes.length && `Comprimento: ${attributes.length}`,
    attributes.width && `Largura: ${attributes.width}`,
    attributes.height && `Altura: ${attributes.height}`,
    attributes.frequency && `Frequencia: ${attributes.frequency}`,
    attributes.protection && `Protecao: ${attributes.protection}`,
    attributes.standard && `Norma: ${attributes.standard}`,
  ]);
}

function removeKnownText(value, knownText) {
  return knownText
    ? value.replace(new RegExp(escapeRegExp(knownText), "i"), "")
    : value;
}

function inferSpecificationsFromDescription(parts, category, product, manufacturerReferences) {
  const manufacturers = manufacturerReferences.map((reference) => reference.manufacturer);
  const codes = manufacturerReferences.flatMap((reference) => reference.codes);

  return unique(
    parts
      .map((part) => {
        let specification = cleanPart(part)
          .replace(/\b(?:tp|tipo)\s*:\s*.*$/i, "")
          .replace(/\bmod\.?\s*[^;\n|]+/i, "")
          .replace(/\bfabricante\s*:\s*[^;\n|]+/i, "");
        specification = specification.replace(/\bfabricante\b\s*:?\s*/i, "");

        specification = removeKnownText(specification, category);
        specification = removeKnownText(specification, product);

        [...manufacturers, ...codes].forEach((knownText) => {
          specification = removeKnownText(specification, knownText);
        });

        return cleanPart(specification.replace(/^[;:,\s-]+|[;:,\s-]+$/g, ""));
      })
      .filter(Boolean)
  );
}

function findManufacturers(normalizedText) {
  const knownMatches = KNOWN_MANUFACTURERS
    .map((manufacturer) => {
      const match = normalizedText.match(new RegExp(`\\b${escapeRegExp(manufacturer)}\\b`));

      return {
        manufacturer,
        position: match?.index ?? -1,
      };
    })
    .filter((item) => item.position >= 0);

  const candidateMatches = [];
  const candidateRegex = /\b[A-Z][A-Z0-9-]{2,}\b/g;
  let match = candidateRegex.exec(normalizedText);

  while (match) {
    const candidate = match[0];
    const before = normalizedText.slice(Math.max(0, match.index - 20), match.index);
    const previousLabel = before.match(/([A-Z]{3,})\s*$/)?.[1] || "";
    const hasManufacturerContext = /(?:MARCA|FABRICANTE|FAB)\s*$/.test(before);

    if (
      hasManufacturerContext &&
      !GENERIC_CODE_LABELS.includes(previousLabel) &&
      !NON_MANUFACTURER_WORDS.includes(candidate) &&
      !/\d/.test(candidate)
    ) {
      candidateMatches.push({ manufacturer: candidate, position: match.index });
    }

    match = candidateRegex.exec(normalizedText);
  }

  return [...knownMatches, ...candidateMatches]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.manufacturer)
    .filter((manufacturer, index, list) => list.indexOf(manufacturer) === index);
}

function extractModelAfterType(text) {
  const match = text.match(/\b(?:Tp|Tipo)\s*:\s*([^;\n]+)/i);
  return cleanPart(match?.[1] || "");
}

function extractTypeManufacturerReference(text, manufacturers) {
  const modelAfterType = extractModelAfterType(text);
  if (!modelAfterType) return null;

  for (const manufacturer of manufacturers) {
    const match = modelAfterType.match(new RegExp(`^${manufacturer}\\b\\s+(.+)$`, "i"));
    const code = cleanReference(match?.[1] || "");

    if (code) {
      return {
        manufacturer,
        code,
        fragment: modelAfterType,
        note: "",
        confidence: "Forte",
      };
    }
  }

  const inferredMatch = modelAfterType.match(/^([A-Z][A-Z0-9-]{2,})\s+(.+)$/i);
  const inferredManufacturer = normalizeText(inferredMatch?.[1] || "");
  const inferredCode = cleanReference(inferredMatch?.[2] || "");

  if (
    inferredManufacturer &&
    inferredCode &&
    /\d/.test(inferredCode) &&
    !GENERIC_CODE_LABELS.includes(inferredManufacturer) &&
    !NON_MANUFACTURER_WORDS.includes(inferredManufacturer)
  ) {
    return {
      manufacturer: inferredManufacturer,
      code: inferredCode,
      fragment: modelAfterType,
      note: "",
      confidence: "Forte",
    };
  }

  return null;
}

function cleanReference(value) {
  return cleanPart(value)
    .replace(/^[|;:,\s-]+/, "")
    .replace(/[|;:,\s-]+$/, "")
    .replace(/\b(?:FABRICANTE|REFERENCIA|REFERÊNCIA)\b.*$/i, "")
    .trim();
}

function extractExplicitReferencePairs(text) {
  const pairs = [];
  const referenceBeforeManufacturer =
    /refer[eê]ncia\s*:\s*([^/;\n]+?)\s*\/\s*fabricante\s*:\s*([^/;\n-]+)/gi;
  const manufacturerBeforeReference =
    /fabricante\s*:\s*([^/;\n-]+)\s*\/\s*refer[eê]ncia\s*:\s*([^/;\n]+)/gi;

  for (const match of text.matchAll(referenceBeforeManufacturer)) {
    pairs.push({
      manufacturer: normalizeText(match[2]),
      code: cleanReference(match[1]),
      fragment: cleanPart(match[0]),
      note: "",
      confidence: "Forte",
    });
  }

  for (const match of text.matchAll(manufacturerBeforeReference)) {
    pairs.push({
      manufacturer: normalizeText(match[1]),
      code: cleanReference(match[2]),
      fragment: cleanPart(match[0]),
      note: "",
      confidence: "Forte",
    });
  }

  return pairs.filter((pair) => pair.manufacturer && pair.code);
}

function extractLeadingManufacturerReference(text, manufacturers) {
  const firstTypeLabel = text.search(/\b(?:tp|tipo)\s*:/i);

  if (firstTypeLabel >= 0) {
    const prefixBeforeType = text.slice(0, firstTypeLabel);
    const segmentsBeforeType = prefixBeforeType.split(/[;\n|]+/);

    for (const manufacturer of manufacturers) {
      const segment = segmentsBeforeType.find((item) => new RegExp(`\\b${manufacturer}\\b`, "i").test(item));
      const match = segment?.match(new RegExp(`\\b${manufacturer}\\b\\s+([^;\\n-]+(?:[-. ][A-Z0-9]+)*)`, "i"));
      const code = cleanReference(match?.[1] || "");

      if (code) {
        return {
          manufacturer,
          code,
          fragment: cleanPart(match[0]),
        };
      }
    }

    return null;
  }
  const firstExplicitLabel = text.search(/\b(?:refer[eê]ncia|fabricante)\s*:/i);
  const prefix = firstExplicitLabel >= 0 ? text.slice(0, firstExplicitLabel) : text;

  for (const manufacturer of manufacturers) {
    const match = prefix.match(new RegExp(`\\b${manufacturer}\\b\\s+([^;\\n-]+(?:[-. ][A-Z0-9]+)*)`, "i"));

    if (match) {
      const code = cleanReference(match[1])
        .replace(/\b(?:REFERENCIA|REFERÊNCIA|FABRICANTE)\b.*$/i, "")
        .replace(/-+$/, "")
        .trim();

      if (code) {
        return {
          manufacturer,
          code,
          fragment: cleanPart(match[0]),
        };
      }
    }
  }

  return null;
}

function findDisallowedTechnicalTokens(fragment) {
  const normalizedFragment = normalizeText(fragment);
  const tokens = [];

  tokens.push(...(normalizedFragment.match(/\b\d+(?:[,.]\d+)?\s*W\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b\d+(?:[,.]\d+)?\s*AH\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b\d+(?:[,.]\d+)?\s*M\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b\d+\s*\/\s*\d+\s*MBPS\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b\d+(?:[,.]\d+)?\s*MM\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b\d{2,4}\s*[-/]\s*\d{2,4}\s*V(?:CA|CC|AC|DC)?\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b\d{1,4}\s*V(?:CA|CC|AC|DC)?\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b\d{2}\s*\/\s*\d{2}\s*HZ\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\bC\d+\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\bIP\s*\d{2}\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\bNBR\s+IEC\s+\d+\b/g) || []));
  tokens.push(...(normalizedFragment.match(/\b(?:ABNT\s+)?NBR\s+\d+\b/g) || []));

  return tokens.flatMap((token) => {
    const compact = token.replace(/\s+/g, "");
    const compactWithoutElectricalSuffix = compact.replace(/(CA|CC|AC|DC)$/i, "");

    return [
      ...(token.match(/[A-Z0-9]+(?:[-/][A-Z0-9]+)*/g) || []),
      compact,
      compactWithoutElectricalSuffix,
    ];
  });
}

function extractCodesFromFragment(fragment, manufacturers, { allowAlphaModel = false } = {}) {
  const disallowedTechnicalTokens = findDisallowedTechnicalTokens(fragment);
  const codes = fragment.match(/\b[A-Z0-9]+(?:[-/][A-Z0-9]+)*\b/gi) || [];

  return unique(
    codes.filter((code) => {
      const normalizedCode = normalizeText(code);
      const hasDigit = /\d/.test(normalizedCode);
      const looksLikeAlphaModel = allowAlphaModel && /^[A-Z]{3,}(?:-[A-Z]{2,})*$/.test(normalizedCode);

      return (
        (hasDigit || looksLikeAlphaModel) &&
        normalizedCode.length >= 3 &&
        !manufacturers.includes(normalizedCode) &&
        !GENERIC_CODE_LABELS.includes(normalizedCode) &&
        !NON_MANUFACTURER_WORDS.includes(normalizedCode) &&
        normalizedCode !== "OU" &&
        !disallowedTechnicalTokens.includes(normalizedCode)
      );
    })
  );
}

function extractCodes(text, manufacturers) {
  const modelAfterType = extractModelAfterType(text);
  const codes = [];
  const labeledCodeMatches = text.matchAll(
    /\b(?:cod|codigo|codigos|modelo|modelos|ref|referencia|referencias)\b\s*:?\s*([^;\n]+)/gi
  );

  if (modelAfterType) {
    const withoutManufacturer = manufacturers.reduce(
      (current, manufacturer) => current.replace(new RegExp(`\\b${manufacturer}\\b`, "i"), ""),
      modelAfterType
    );

    codes.push(...extractCodesFromFragment(withoutManufacturer, manufacturers, { allowAlphaModel: true }));
  }

  for (const match of labeledCodeMatches) {
    codes.push(...extractCodesFromFragment(match[1], manufacturers, { allowAlphaModel: true }));
  }

  codes.push(...extractCodesFromFragment(text, manufacturers));

  return unique(
    codes.filter((code) => {
      const normalizedCode = normalizeText(code);
      return (
        normalizedCode.length >= 3 &&
        !manufacturers.includes(normalizedCode) &&
        normalizedCode !== "220" &&
        normalizedCode !== "240" &&
        !normalizedCode.endsWith("HZ")
      );
    })
  );
}

function extractManufacturerReferences(text, manufacturers) {
  const explicitPairs = extractExplicitReferencePairs(text);
  const leadingPair = extractLeadingManufacturerReference(text, manufacturers);
  const typePair = extractTypeManufacturerReference(text, manufacturers);
  if (manufacturers.length === 0 && !typePair) return [];

  if (explicitPairs.length > 0 || leadingPair || typePair) {
    const grouped = new Map();

    [leadingPair, typePair, ...explicitPairs].filter(Boolean).forEach((pair) => {
      const manufacturer = pair.manufacturer;
      const groupKey = pair.confidence === "Revisar" ? `${manufacturer}:${pair.code}` : manufacturer;
      const current = grouped.get(groupKey) || {
        manufacturer,
        codes: [],
        fragment: "",
        notes: [],
        confidence: pair.confidence || "Forte",
      };

      current.codes = unique([...current.codes, pair.code]);
      current.fragment = unique([current.fragment, pair.fragment]).join(" | ");
      current.notes = unique([...current.notes, pair.note || ""]);
      current.confidence =
        current.confidence === "Revisar" || pair.confidence === "Revisar"
          ? "Revisar"
          : "Forte";
      grouped.set(groupKey, current);
    });

    return [...grouped.values()];
  }

  const references = manufacturers.map((manufacturer, index) => {
    const current = new RegExp(`\\b${manufacturer}\\b`, "i");
    const start = text.search(current);

    if (start === -1) {
      return {
        manufacturer,
        codes: [],
        fragment: "",
      };
    }

    const nextStarts = manufacturers
      .filter((nextManufacturer) => nextManufacturer !== manufacturer)
      .map((nextManufacturer) => text.slice(start + manufacturer.length).search(new RegExp(`\\b${nextManufacturer}\\b`, "i")))
      .filter((position) => position >= 0)
      .map((position) => start + manufacturer.length + position);

    const nextStart = nextStarts.length > 0 ? Math.min(...nextStarts) : text.length;
    const fragment = cleanPart(text.slice(start, nextStart));
    const fragmentWithoutManufacturer = fragment
      .replace(current, "")
      .split(/\b(?:cod|codigo|codigos|modelo|modelos|ref|referencia|referencias)\b\s*:?\s*/i)[0];
    const fragmentCodes = extractCodesFromFragment(fragmentWithoutManufacturer, manufacturers, { allowAlphaModel: true });

    return {
      manufacturer,
      codes: fragmentCodes,
      fragment,
      order: index,
    };
  });

  const modelAfterType = extractModelAfterType(text);

  if (references.length === 1 && modelAfterType && references[0].codes.length === 0) {
    const withoutManufacturer = modelAfterType.replace(new RegExp(`\\b${references[0].manufacturer}\\b`, "i"), "");
    references[0].codes = extractCodesFromFragment(withoutManufacturer, manufacturers, { allowAlphaModel: true });
    references[0].fragment = modelAfterType;
  }

  return references.map((reference) => ({
    manufacturer: reference.manufacturer,
    codes: reference.codes,
    fragment: reference.fragment,
  }));
}

export function standardizeItemDescription(description) {
  const text = cleanPart(description);
  const normalizedText = normalizeText(text);
  const parts = unique(text.split(/[;\n|]+/));
  const manufacturers = findManufacturers(normalizedText);
  const rawManufacturerReferences = extractManufacturerReferences(text, manufacturers);
  const observations = rawManufacturerReferences
    .filter((reference) => reference.confidence === "Revisar")
    .flatMap((reference) =>
      reference.codes.map((code) =>
        `Codigo ${code}: ${reference.notes?.join("; ") || "fabricante nao identificado com seguranca"}`
      )
    );
  const extractedManufacturerReferences = rawManufacturerReferences.filter(
    (reference) => reference.confidence !== "Revisar"
  );
  const referenceCodes = rawManufacturerReferences.flatMap((reference) => reference.codes);
  const codes = referenceCodes.length > 0 ? unique(referenceCodes) : extractCodes(text, manufacturers);
  const allReferencesWithoutCodes =
    extractedManufacturerReferences.length > 0 &&
    extractedManufacturerReferences.every((reference) => reference.codes.length === 0);
  const manufacturerReferences =
    allReferencesWithoutCodes && manufacturers.length === codes.length
      ? extractedManufacturerReferences.map((reference, index) => ({
          ...reference,
          codes: [codes[index]],
        }))
      : extractedManufacturerReferences;
  const visibleManufacturerReferences = manufacturerReferences.map((reference) => ({
    manufacturer: reference.manufacturer,
    codes: reference.codes,
    fragment: reference.fragment,
  }));
  const visibleManufacturers =
    visibleManufacturerReferences.length > 0
      ? unique(visibleManufacturerReferences.map((reference) => reference.manufacturer))
      : manufacturers;
  const power = findFirst(text, /\b\d+(?:[,.]\d+)?\s*W\b/i);
  const voltage =
    findFirst(text, /\b\d{2,4}\s*[-/]\s*\d{2,4}\s*V(?:ca|cc|ac|dc)?\b/i) ||
    findFirst(text, /\b\d{1,4}\s*V(?:ca|cc|ac|dc)?\b/i);
  const frequency = findFirst(text, /\b\d{2}\s*\/\s*\d{2}\s*Hz\b/i);
  const protection = findFirst(text, /\bIP\s*\d{2}\b/i);
  const standard =
    findFirst(text, /\bNBR\s+IEC\s+\d+\b/i) ||
    findFirst(text, /\b(?:ABNT\s+)?NBR\s+\d+\b/i);
  const capacity = findFirst(text, /\b\d+(?:[,.]\d+)?\s*Ah\b/i);
  const dischargeRate = findFirst(text, /\bC\d+\b/i);
  const length = findFirst(text, /\b\d+(?:[,.]\d+)?\s*mm\s+de\s+comprimento\b/i);
  const width = findFirst(text, /\b\d+(?:[,.]\d+)?\s*mm\s+de\s+largura\b/i);
  const height = findFirst(text, /\b\d+(?:[,.]\d+)?\s*mm\s+de\s+altura\b/i);
  const dimensions = findFirst(text, /\b\d+(?:[,.]\d+)?\s*\(alt\)\s*x\s*\d+(?:[,.]\d+)?\s*\(larg\)\s*x\s*\d+(?:[,.]\d+)?\s*m\s*\(prof\)/i);
  const range = findFirst(text, /\b\d+(?:[,.]\d+)?\s*m\b(?!\s*[³3]\s*\/\s*h)/i);
  const color =
    parts.find((part) => normalizeText(part).includes("CINZA")) ||
    parts.find((part) => normalizeText(part).includes("VERMELHO")) ||
    "";
  const bodyMaterial = parts.find((part) => normalizeText(part).includes("CORPO EM")) || "";
  const reflector = parts.find((part) => normalizeText(part).includes("REFLETOR")) || "";
  const receptacle = parts.find((part) => normalizeText(part).includes("RECEPTACULO")) || "";
  const model = extractModelAfterType(text);
  const category = findCategory(normalizedText) || inferCategoryFromFirstPart(parts);
  const attributes = {
    product: parts[0] || "",
    type: parts[1] || "",
    technology: parts.find((part) => normalizeText(part).includes("LED")) || "",
    power,
    voltage,
    capacity,
    dischargeRate,
    length,
    width,
    height,
    dimensions,
    range,
    frequency,
    bodyMaterial,
    color,
    reflector,
    receptacle,
    protection,
    standard,
    model,
  };

  const inferredSpecifications = inferSpecificationsFromDescription(
    parts,
    category,
    attributes.product,
    visibleManufacturerReferences
  );
  const specifications =
    inferredSpecifications.length > 0 ? inferredSpecifications : findSpecifications(parts, attributes);

  return {
    rawDescription: description,
    normalizedDescription: parts.join("; "),
    category,
    manufacturers: visibleManufacturers,
    manufacturerReferences: visibleManufacturerReferences.length > 0
      ? visibleManufacturerReferences
      : manufacturers.map((manufacturer) => ({ manufacturer, codes: [], fragment: "" })),
    codes,
    specifications,
    observations,
    attributes,
  };
}

export function formatStandardizedSummary(standardized) {
  const attributes = standardized?.attributes || {};

  return [
    attributes.product,
    attributes.type,
    attributes.technology,
    attributes.power && `Potencia: ${attributes.power}`,
    attributes.voltage && `Tensao: ${attributes.voltage}`,
    attributes.frequency && `Frequencia: ${attributes.frequency}`,
    attributes.bodyMaterial,
    attributes.color && `Cor: ${attributes.color}`,
    attributes.reflector,
    attributes.receptacle,
    attributes.protection && `Protecao: ${attributes.protection}`,
    attributes.standard && `Norma: ${attributes.standard}`,
    attributes.model && `Modelo: ${attributes.model}`,
  ]
    .filter(Boolean)
    .join(" | ");
}
