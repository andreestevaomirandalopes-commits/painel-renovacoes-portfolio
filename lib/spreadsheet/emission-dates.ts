import * as XLSX from "xlsx";

type SheetRow = Record<string, unknown>;

export type EmissionDateSourceRow = {
  line: number;
  orderNumber: string;
  issuedAt: Date | null;
  sourceExpirationDate: Date | null;
  errors: string[];
};

const aliases: Record<"orderNumber" | "issuedAt" | "expirationDate", string[]> = {
  orderNumber: ["pedido", "pedido gar", "pedido certisign", "n pedido", "no pedido", "nr pedido", "cd pedido", "numero pedido", "numero do pedido", "numero pedido cliente", "numero da proposta", "proposta"],
  issuedAt: ["data emissao", "data de emissao", "dt emissao", "dt de emissao", "emissao", "emissao certificado", "emissao do certificado", "data emissao certificado", "data de emissao certificado", "dt emissao certificado", "dt de emissao certificado", "data emissao do certificado", "data de emissao do certificado"],
  expirationDate: ["vencimento", "data vencimento", "data de vencimento", "dt vencimento", "data expiracao", "data de expiracao", "dt expiracao", "validade"],
};

const normalizeHeader = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const mappedField = (header: string) => {
  const normalized = normalizeHeader(header);
  return (Object.keys(aliases) as Array<keyof typeof aliases>).find((field) => aliases[field].includes(normalized));
};

function dateFromParts(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Converte datas do Excel, DD/MM/AAAA e AAAA-MM-DD sem depender do fuso do servidor. */
export function parseSpreadsheetDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? dateFromParts(parsed.y, parsed.m, parsed.d) : null;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;
  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+.*)?$/);
  if (br) return dateFromParts(Number(br[3]), Number(br[2]), Number(br[1]));
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (iso) return dateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (/^\d{5}$/.test(text)) {
    const parsed = XLSX.SSF.parse_date_code(Number(text));
    return parsed ? dateFromParts(parsed.y, parsed.m, parsed.d) : null;
  }
  return null;
}

export function canonicalOrderNumber(value: string) {
  const trimmed = value.trim();
  if (/^\d+(?:\.0+)?$/.test(trimmed)) {
    const digits = trimmed.replace(/\.0+$/, "");
    return digits.replace(/^0+(?=\d)/, "") || "0";
  }
  return trimmed.toUpperCase().replace(/\s+/g, "");
}

export function formatCalendarDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function readEmissionDateWorkbook(buffer: ArrayBuffer): SheetRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "", raw: true, dateNF: "yyyy-mm-dd" });
}

export function emissionDateHeadersMissing(rows: SheetRow[]) {
  if (!rows.length) return ["A planilha está vazia"];
  const found = new Set(Object.keys(rows[0]).map(mappedField).filter(Boolean));
  const required: Array<keyof typeof aliases> = ["orderNumber", "issuedAt"];
  const labels = { orderNumber: "Número do pedido", issuedAt: "Data de emissão", expirationDate: "Data de vencimento" };
  return required.filter((field) => !found.has(field)).map((field) => labels[field]);
}

export function validateEmissionDateRows(rows: SheetRow[]): EmissionDateSourceRow[] {
  return rows.map((row, index) => {
    const values: Partial<Record<keyof typeof aliases, unknown>> = {};
    for (const [header, value] of Object.entries(row)) {
      const field = mappedField(header);
      if (field) values[field] = value;
    }
    const orderNumber = String(values.orderNumber ?? "").trim();
    const issuedAt = parseSpreadsheetDate(values.issuedAt);
    const sourceExpirationDate = values.expirationDate === undefined || values.expirationDate === "" ? null : parseSpreadsheetDate(values.expirationDate);
    const errors: string[] = [];
    if (!orderNumber || orderNumber === "0") errors.push("Número do pedido inválido");
    if (!issuedAt) errors.push("Data de emissão inválida");
    if (values.expirationDate !== undefined && values.expirationDate !== "" && !sourceExpirationDate) errors.push("Data de vencimento inválida");
    return { line: index + 2, orderNumber, issuedAt, sourceExpirationDate, errors };
  });
}
