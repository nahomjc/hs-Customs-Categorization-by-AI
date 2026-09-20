import * as XLSX from "xlsx";
import {
  detectColumnMappings,
  type VddColumnMappings,
  type VddFieldKey,
  VDD_FIELD_KEYS,
} from "./column-map";
import {
  buildDataQualityFlags,
  buildNormalizedSearchText,
  cellToString,
  normalizeCurrencyCode,
  normalizeOriginCode,
  normalizeTextField,
  normalizeVddHsCode,
  parseOptionalNumber,
} from "./normalize";

export type VddParsedRecord = {
  sourceRowNumber: number;
  importerName: string | null;
  declarationNumber: string | null;
  hsCode: string;
  unitOfQuantity: string | null;
  originCode: string | null;
  countryName: string | null;
  brandOrMake: string | null;
  model: string | null;
  commonName: string | null;
  condition: string | null;
  commercialDescription: string | null;
  appearance: string | null;
  material: string | null;
  size: string | null;
  productType: string | null;
  diameter: string | null;
  width: string | null;
  length: string | null;
  declaredUnitPrice: string | null;
  netMass: string | null;
  grossMass: string | null;
  currencyCode: string;
  normalizedText: string;
  normalizedData: Record<string, unknown>;
  rawRow: Record<string, string>;
  extraAttributes: Record<string, string>;
  dataQualityFlags: string[];
};

export type VddInvalidRow = {
  sourceRowNumber: number;
  reasons: string[];
  rawRow: Record<string, string>;
};

export type VddParseResult = {
  sheetNames: string[];
  sheetName: string;
  headers: string[];
  detectedMappings: VddColumnMappings;
  effectiveMappings: VddColumnMappings;
  extraHeaders: string[];
  totalDataRows: number;
  validRows: VddParsedRecord[];
  invalidRows: VddInvalidRow[];
  previewRows: Array<{
    sourceRowNumber: number;
    valid: boolean;
    reasons: string[];
    data: Partial<Record<VddFieldKey, string | null>>;
    extraAttributes: Record<string, string>;
    dataQualityFlags: string[];
  }>;
};

function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
}

function findHeaderRowIndex(matrix: unknown[][]): number {
  const maxScan = Math.min(matrix.length, 30);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i++) {
    const row = matrix[i] ?? [];
    const headers = row.map((c) => cellToString(c));
    const nonEmpty = headers.filter(Boolean).length;
    if (nonEmpty < 3) continue;
    const detected = detectColumnMappings(headers);
    const score = Object.keys(detected).length * 10 + nonEmpty;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function rowToRawObject(
  headers: string[],
  row: unknown[],
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;
    raw[header] = cellToString(row[i]);
  }
  return raw;
}

function getMappedValue(
  rawRow: Record<string, string>,
  mappings: VddColumnMappings,
  field: VddFieldKey,
): string {
  const header = mappings[field];
  if (!header) return "";
  return rawRow[header] ?? "";
}

/** Headers used by known field mappings. */
export function getMappedHeaderSet(mappings: VddColumnMappings): Set<string> {
  const set = new Set<string>();
  for (const key of VDD_FIELD_KEYS) {
    const header = mappings[key];
    if (header) set.add(header);
  }
  return set;
}

/** Non-empty sheet headers not mapped to a known VDD field. */
export function computeExtraHeaders(
  headers: string[],
  mappings: VddColumnMappings,
): string[] {
  const mapped = getMappedHeaderSet(mappings);
  const seen = new Set<string>();
  const extras: string[] = [];
  for (const header of headers) {
    if (!header || mapped.has(header) || seen.has(header)) continue;
    seen.add(header);
    extras.push(header);
  }
  return extras;
}

export function buildExtraAttributes(
  rawRow: Record<string, string>,
  extraHeaders: string[],
): Record<string, string> {
  const extras: Record<string, string> = {};
  for (const header of extraHeaders) {
    const value = (rawRow[header] ?? "").trim();
    if (value) extras[header] = value;
  }
  return extras;
}

function emptyParseResult(
  partial: Partial<VddParseResult> & {
    sheetNames: string[];
    sheetName: string;
  },
): VddParseResult {
  return {
    headers: [],
    detectedMappings: {},
    effectiveMappings: {},
    extraHeaders: [],
    totalDataRows: 0,
    validRows: [],
    invalidRows: [],
    previewRows: [],
    ...partial,
  };
}

function parseDataRow(
  sourceRowNumber: number,
  rawRow: Record<string, string>,
  mappings: VddColumnMappings,
  extraHeaders: string[],
): { valid: VddParsedRecord | null; invalid: VddInvalidRow | null } {
  const reasons: string[] = [];

  const hsRaw = getMappedValue(rawRow, mappings, "hs_code");
  const hsCode = normalizeVddHsCode(hsRaw);
  if (!hsCode) {
    reasons.push(
      hsRaw
        ? `Invalid HS code: "${hsRaw}"`
        : "Missing required HS code",
    );
  }

  const hasAnyContent = Object.values(rawRow).some((v) => v.trim());
  if (!hasAnyContent) {
    return {
      valid: null,
      invalid: {
        sourceRowNumber,
        reasons: ["Empty row"],
        rawRow,
      },
    };
  }

  if (!hsCode || reasons.length > 0) {
    return {
      valid: null,
      invalid: {
        sourceRowNumber,
        reasons: reasons.length ? reasons : ["Invalid row"],
        rawRow,
      },
    };
  }

  const importerName = normalizeTextField(
    "importer_name",
    getMappedValue(rawRow, mappings, "importer_name"),
  );
  const declarationNumber = normalizeTextField(
    "declaration_number",
    getMappedValue(rawRow, mappings, "declaration_number"),
  );
  const unitOfQuantity = normalizeTextField(
    "unit_of_quantity",
    getMappedValue(rawRow, mappings, "unit_of_quantity"),
  );
  const originCode = normalizeOriginCode(
    getMappedValue(rawRow, mappings, "origin_code"),
  );
  const countryName = normalizeTextField(
    "country_name",
    getMappedValue(rawRow, mappings, "country_name"),
  );
  const brandOrMake = normalizeTextField(
    "brand_or_make",
    getMappedValue(rawRow, mappings, "brand_or_make"),
  );
  const model = normalizeTextField(
    "model",
    getMappedValue(rawRow, mappings, "model"),
  );
  const commonName = normalizeTextField(
    "common_name",
    getMappedValue(rawRow, mappings, "common_name"),
  );
  const condition = normalizeTextField(
    "condition",
    getMappedValue(rawRow, mappings, "condition"),
  );
  const commercialDescription = normalizeTextField(
    "commercial_description",
    getMappedValue(rawRow, mappings, "commercial_description"),
  );
  const appearance = normalizeTextField(
    "appearance",
    getMappedValue(rawRow, mappings, "appearance"),
  );
  const material = normalizeTextField(
    "material",
    getMappedValue(rawRow, mappings, "material"),
  );
  const size = normalizeTextField(
    "size",
    getMappedValue(rawRow, mappings, "size"),
  );
  const productType = normalizeTextField(
    "product_type",
    getMappedValue(rawRow, mappings, "product_type"),
  );

  const diameter = parseOptionalNumber(
    getMappedValue(rawRow, mappings, "diameter"),
  );
  const width = parseOptionalNumber(getMappedValue(rawRow, mappings, "width"));
  const length = parseOptionalNumber(getMappedValue(rawRow, mappings, "length"));
  const declaredUnitPrice = parseOptionalNumber(
    getMappedValue(rawRow, mappings, "declared_unit_price"),
  );
  const netMass = parseOptionalNumber(
    getMappedValue(rawRow, mappings, "net_mass"),
  );
  const grossMass = parseOptionalNumber(
    getMappedValue(rawRow, mappings, "gross_mass"),
  );
  const currencyCode = normalizeCurrencyCode(
    getMappedValue(rawRow, mappings, "currency_code"),
  );

  const dataQualityFlags = buildDataQualityFlags({
    hsCode,
    appearance,
    material,
    commonName,
    commercialDescription,
  });

  const normalizedText = buildNormalizedSearchText({
    commonName,
    commercialDescription,
    brandOrMake,
    model,
    productType,
    material,
    condition,
    countryName,
    originCode,
    hsCode,
  });

  const extraAttributes = buildExtraAttributes(rawRow, extraHeaders);

  const record: VddParsedRecord = {
    sourceRowNumber,
    importerName,
    declarationNumber,
    hsCode,
    unitOfQuantity,
    originCode,
    countryName,
    brandOrMake,
    model,
    commonName,
    condition,
    commercialDescription,
    appearance,
    material,
    size,
    productType,
    diameter,
    width,
    length,
    declaredUnitPrice,
    netMass,
    grossMass,
    currencyCode,
    normalizedText,
    normalizedData: {
      mappedFields: Object.keys(mappings),
      extraHeaderCount: Object.keys(extraAttributes).length,
    },
    rawRow,
    extraAttributes,
    dataQualityFlags,
  };

  return { valid: record, invalid: null };
}

export type ParseVddWorkbookOptions = {
  sheetName?: string;
  columnMappings?: VddColumnMappings;
  previewLimit?: number;
};

export function listVddWorkbookSheets(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  return workbook.SheetNames;
}

export function parseVddWorkbookBuffer(
  buffer: Buffer,
  options: ParseVddWorkbookOptions = {},
): VddParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    return emptyParseResult({ sheetNames: [], sheetName: "" });
  }

  const sheetName =
    options.sheetName && sheetNames.includes(options.sheetName)
      ? options.sheetName
      : sheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = sheetToMatrix(sheet);

  if (matrix.length === 0) {
    return emptyParseResult({
      sheetNames,
      sheetName,
      effectiveMappings: options.columnMappings ?? {},
    });
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  const headerCells = matrix[headerRowIndex] ?? [];
  const headers = headerCells.map((c) => cellToString(c));

  const detectedMappings = detectColumnMappings(headers);
  const effectiveMappings: VddColumnMappings = {
    ...detectedMappings,
    ...(options.columnMappings ?? {}),
  };

  // Drop mappings that point at non-existent headers
  for (const key of VDD_FIELD_KEYS) {
    const header = effectiveMappings[key];
    if (header && !headers.includes(header)) {
      delete effectiveMappings[key];
    }
  }

  const nonEmptyHeaders = headers.filter(Boolean);
  const extraHeaders = computeExtraHeaders(nonEmptyHeaders, effectiveMappings);

  const validRows: VddParsedRecord[] = [];
  const invalidRows: VddInvalidRow[] = [];
  const previewLimit = options.previewLimit ?? 20;
  const previewRows: VddParseResult["previewRows"] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const sourceRowNumber = i + 1; // 1-based Excel row
    const rawRow = rowToRawObject(headers, row);

    if (!Object.values(rawRow).some((v) => v.trim())) {
      continue;
    }

    const { valid, invalid } = parseDataRow(
      sourceRowNumber,
      rawRow,
      effectiveMappings,
      extraHeaders,
    );

    if (valid) {
      validRows.push(valid);
      if (previewRows.length < previewLimit) {
        previewRows.push({
          sourceRowNumber,
          valid: true,
          reasons: [],
          data: {
            hs_code: valid.hsCode,
            importer_name: valid.importerName,
            declaration_number: valid.declarationNumber,
            brand_or_make: valid.brandOrMake,
            model: valid.model,
            common_name: valid.commonName,
            commercial_description: valid.commercialDescription,
            origin_code: valid.originCode,
            country_name: valid.countryName,
            unit_of_quantity: valid.unitOfQuantity,
            declared_unit_price: valid.declaredUnitPrice,
            currency_code: valid.currencyCode,
            material: valid.material,
            appearance: valid.appearance,
            condition: valid.condition,
          },
          extraAttributes: valid.extraAttributes,
          dataQualityFlags: valid.dataQualityFlags,
        });
      }
    } else if (invalid) {
      invalidRows.push(invalid);
      if (previewRows.length < previewLimit) {
        previewRows.push({
          sourceRowNumber,
          valid: false,
          reasons: invalid.reasons,
          data: {
            hs_code:
              getMappedValue(rawRow, effectiveMappings, "hs_code") || null,
            common_name:
              getMappedValue(rawRow, effectiveMappings, "common_name") || null,
            commercial_description:
              getMappedValue(
                rawRow,
                effectiveMappings,
                "commercial_description",
              ) || null,
          },
          extraAttributes: buildExtraAttributes(rawRow, extraHeaders),
          dataQualityFlags: [],
        });
      }
    }
  }

  return {
    sheetNames,
    sheetName,
    headers: nonEmptyHeaders,
    detectedMappings,
    effectiveMappings,
    extraHeaders,
    totalDataRows: validRows.length + invalidRows.length,
    validRows,
    invalidRows,
    previewRows,
  };
}

/** Slim invalid rows for JSON error_report storage. */
export function serializeInvalidRowsForReport(
  rows: VddInvalidRow[],
  limit = 200,
): Array<{ sourceRowNumber: number; reasons: string[] }> {
  return rows.slice(0, limit).map((r) => ({
    sourceRowNumber: r.sourceRowNumber,
    reasons: r.reasons,
  }));
}
