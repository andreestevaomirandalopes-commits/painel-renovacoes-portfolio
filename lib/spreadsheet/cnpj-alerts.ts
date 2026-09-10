import * as XLSX from "xlsx";

export type CnpjAlertImportValues = {
  cnpj: string;
  legalName: string;
  tradeName?: string;
  openingDate?: string;
  registrationStatus?: string;
  cnae?: string;
  city: string;
  state: string;
  email?: string;
  phone?: string;
  source: string;
};

export type CnpjAlertPreviewRow = {
  line: number;
  values: CnpjAlertImportValues;
  valid: boolean;
  errors: string[];
  existing?: boolean;
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const fields: Record<string, keyof CnpjAlertImportValues> = {
  cnpj: "cnpj",
  "razao social": "legalName",
  razao: "legalName",
  empresa: "legalName",
  "nome fantasia": "tradeName",
  fantasia: "tradeName",
  "data de abertura": "openingDate",
  "data abertura": "openingDate",
  abertura: "openingDate",
  "situacao cadastral": "registrationStatus",
  situacao: "registrationStatus",
  cnae: "cnae",
  "cnae principal": "cnae",
  cidade: "city",
  municipio: "city",
  uf: "state",
  estado: "state",
  email: "email",
  "e mail": "email",
  telefone: "phone",
  celular: "phone",
};

const toText = (value: unknown) => String(value ?? "").trim();

export function readCnpjAlertWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
}

export function normalizeCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  // O Excel pode remover o zero à esquerda de alguns CNPJs quando a célula está como número.
  return digits.length === 13 ? `0${digits}` : digits;
}

export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculate = (digits: string, weights: number[]) => weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const digit = (sum: number) => {
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(calculate(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  const second = digit(calculate(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return Number(cnpj[12]) === first && Number(cnpj[13]) === second;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const date = new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function cnpjAlertHeadersMissing(rows: Record<string, unknown>[]) {
  if (!rows.length) return ["A planilha está vazia"];
  const found = new Set(Object.keys(rows[0]).map((header) => fields[normalize(header)]).filter(Boolean));
  const required: (keyof CnpjAlertImportValues)[] = ["cnpj", "legalName", "openingDate", "city", "state"];
  const labels: Record<string, string> = { cnpj: "CNPJ", legalName: "Razão Social", openingDate: "Data de Abertura", city: "Cidade", state: "UF" };
  return required.filter((field) => !found.has(field)).map((field) => labels[field]);
}

export function validateCnpjAlerts(rows: Record<string, unknown>[], source = "Importação manual"): CnpjAlertPreviewRow[] {
  return rows.map((row, index) => {
    const values: CnpjAlertImportValues = { cnpj: "", legalName: "", city: "", state: "", source };
    for (const [header, rawValue] of Object.entries(row)) {
      const field = fields[normalize(header)];
      if (field) values[field] = toText(rawValue);
    }
    values.cnpj = normalizeCnpj(values.cnpj);
    values.state = values.state.toUpperCase();
    const errors: string[] = [];
    if (!isValidCnpj(values.cnpj)) errors.push("CNPJ inválido");
    if (!values.legalName) errors.push("Razão Social é obrigatória");
    if (!parseDate(values.openingDate || "")) errors.push("Data de Abertura inválida");
    if (!values.city) errors.push("Cidade é obrigatória");
    if (!/^[A-Z]{2}$/.test(values.state)) errors.push("UF inválida");
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) errors.push("E-mail inválido");
    return { line: index + 2, values, valid: errors.length === 0, errors };
  });
}

export function importOpeningDate(value?: string) {
  return value ? parseDate(value) : null;
}
