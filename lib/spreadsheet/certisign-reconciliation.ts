import * as XLSX from "xlsx";

type SheetRow = Record<string, unknown>;

type SourceFields = {
  orderNumber: string;
  entityCode: string;
  entityName: string;
  vendorCode: string;
  vendorName: string;
  productCode: string;
  productName: string;
  orderStatus: string;
  orderDate: unknown;
  renewalDate: unknown;
  clientName: string;
  voucherType: string;
  previousOrder: string;
  grossAmount: unknown;
  billingAmount: unknown;
  commissionAmount: unknown;
  count: unknown;
};

export type CertisignReconciliationRow = Omit<SourceFields, "orderDate" | "renewalDate" | "grossAmount" | "billingAmount" | "commissionAmount" | "count"> & {
  line: number;
  rawData: Record<string, string>;
  orderDate: Date | null;
  renewalDate: Date | null;
  grossAmount: number | null;
  billingAmount: number | null;
  commissionAmount: number | null;
  count: number | null;
  valid: boolean;
  ignored: boolean;
  requiresManualReview: boolean;
  messages: string[];
};

const aliases: Record<keyof SourceFields, string[]> = {
  orderNumber: ["pedido", "numero pedido", "numero do pedido", "n pedido"],
  entityCode: ["cod ent", "cod entidade", "codigo entidade"],
  entityName: ["des entidade", "desc entidade", "descricao entidade"],
  vendorCode: ["cod vendedor", "codigo vendedor"],
  vendorName: ["nome vendedor"],
  productCode: ["cod produto", "codigo produto"],
  productName: ["desc produto", "des produto", "descricao produto"],
  orderStatus: ["status pedido", "status do pedido"],
  orderDate: ["dt pedido", "data pedido", "data do pedido"],
  renewalDate: ["dt emissao renovacao", "data emissao renovacao", "dt emissao", "data emissao"],
  clientName: ["nome cliente", "cliente"],
  voucherType: ["tipo voucher"],
  previousOrder: ["ped anterior", "pedido anterior"],
  grossAmount: ["val bruto", "valor bruto"],
  billingAmount: ["val faturamento", "valor faturamento"],
  commissionAmount: ["valor tot comiss", "valor total comiss", "valor total comissao"],
  count: ["contagem", "quantidade"],
};

const normalizeHeader = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const sourceText = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getUTCDate()).padStart(2, "0")}/${String(value.getUTCMonth() + 1).padStart(2, "0")}/${value.getUTCFullYear()}`;
  }
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  return String(value ?? "").trim();
};

const sourceField = (header: string) => {
  const normalized = normalizeHeader(header);
  return (Object.entries(aliases) as [keyof SourceFields, string[]][]).find(([, values]) => values.includes(normalized))?.[0];
};

function buildDate(year: number, month: number, day: number) {
  const result = new Date(Date.UTC(year, month - 1, day, 12));
  return result.getUTCFullYear() === year && result.getUTCMonth() === month - 1 && result.getUTCDate() === day ? result : null;
}

export function parseCertisignDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12));
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? buildDate(parsed.y, parsed.m, parsed.d) : null;
  }
  const text = sourceText(value);
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/);
  if (br) return buildDate(Number(br[3]), Number(br[2]), Number(br[1]));
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return iso ? buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) : null;
}

export function parseCertisignMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  const text = sourceText(value);
  if (!text) return null;
  if (/^[r$\s-]+$/i.test(text)) return 0;
  let normalized = text.replace(/R\$/gi, "").replace(/\s/g, "");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) normalized = comma > dot ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  else if (comma >= 0) normalized = normalized.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function parseCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const text = sourceText(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function isIgnoredOrder(orderNumber: string) {
  const normalized = normalizeHeader(orderNumber);
  return !normalized || ["subtotal", "total", "total geral", "--", "-"].includes(normalized) || orderNumber === "--";
}

function sourceValues(row: SheetRow) {
  const values: SourceFields = {
    orderNumber: "", entityCode: "", entityName: "", vendorCode: "", vendorName: "", productCode: "", productName: "", orderStatus: "", orderDate: "", renewalDate: "", clientName: "", voucherType: "", previousOrder: "", grossAmount: "", billingAmount: "", commissionAmount: "", count: "",
  };
  const rawData: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    rawData[header] = sourceText(value);
    const field = sourceField(header);
    if (field) values[field] = value as never;
  }
  return { values, rawData };
}

export function readCertisignWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não possui abas para importar.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Não foi possível abrir a primeira aba da planilha.");
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "", raw: true, dateNF: "dd/mm/yyyy" });
  return { sheetName, rows };
}

export function certisignHeadersMissing(rows: SheetRow[]) {
  if (!rows.length) return ["A planilha está vazia"];
  const fields = new Set(Object.keys(rows[0]).map(sourceField).filter(Boolean));
  return fields.has("orderNumber") ? [] : ["Pedido"];
}

/**
 * A planilha de comissões possui uma área de resumo com chaves PIX. O fluxo de
 * parceiros usa somente as linhas de pedido e exige estes campos do detalhe.
 */
export function certisignPartnerCommissionHeadersMissing(rows: SheetRow[]) {
  if (!rows.length) return ["A planilha está vazia"];
  const fields = new Set(Object.keys(rows[0]).map(sourceField).filter(Boolean));
  const required: [keyof SourceFields, string][] = [
    ["orderNumber", "Pedido"],
    ["vendorCode", "Cod. Vendedor"],
    ["commissionAmount", "Valor Tot. Comiss."],
  ];
  return required.filter(([field]) => !fields.has(field)).map(([, label]) => label);
}

export function validateCertisignRows(rows: SheetRow[]): CertisignReconciliationRow[] {
  const result = rows.map((raw, index) => {
    const { values, rawData } = sourceValues(raw);
    const orderNumber = sourceText(values.orderNumber);
    const ignored = isIgnoredOrder(orderNumber);
    const messages: string[] = [];
    let valid = true;
    let requiresManualReview = false;
    if (!ignored && !orderNumber) {
      valid = false;
      messages.push("Número do pedido não informado");
    }
    if (!ignored && orderNumber && !/^\d{8}$/.test(orderNumber)) {
      requiresManualReview = true;
      messages.push("Pedido fora do padrão de 8 dígitos");
    }
    const orderDateText = sourceText(values.orderDate);
    const renewalDateText = sourceText(values.renewalDate);
    const orderDate = parseCertisignDate(values.orderDate);
    const renewalDate = parseCertisignDate(values.renewalDate);
    const hasOrderDate = Boolean(orderDateText.replace(/[\/\-\s]/g, ""));
    const hasRenewalDate = Boolean(renewalDateText.replace(/[\/\-\s]/g, ""));
    if (!ignored && hasOrderDate && !orderDate) {
      requiresManualReview = true;
      messages.push("Data do pedido não pôde ser interpretada");
    }
    if (!ignored && hasRenewalDate && !renewalDate) {
      requiresManualReview = true;
      messages.push("Data de emissão/renovação não pôde ser interpretada");
    }
    const grossAmount = parseCertisignMoney(values.grossAmount);
    const billingAmount = parseCertisignMoney(values.billingAmount);
    const commissionAmount = parseCertisignMoney(values.commissionAmount);
    if (!ignored && sourceText(values.billingAmount) && billingAmount === null) {
      requiresManualReview = true;
      messages.push("Valor de faturamento não pôde ser interpretado");
    }
    return {
      line: index + 2,
      rawData,
      orderNumber,
      entityCode: sourceText(values.entityCode),
      entityName: sourceText(values.entityName),
      vendorCode: sourceText(values.vendorCode),
      vendorName: sourceText(values.vendorName),
      productCode: sourceText(values.productCode),
      productName: sourceText(values.productName),
      orderStatus: sourceText(values.orderStatus),
      orderDate,
      renewalDate,
      clientName: sourceText(values.clientName),
      voucherType: sourceText(values.voucherType),
      previousOrder: sourceText(values.previousOrder),
      grossAmount,
      billingAmount,
      commissionAmount,
      count: parseCount(values.count),
      valid,
      ignored,
      requiresManualReview,
      messages,
    } satisfies CertisignReconciliationRow;
  });

  const orderGroups = new Map<string, CertisignReconciliationRow[]>();
  for (const row of result) {
    if (!row.valid || row.ignored || !row.orderNumber) continue;
    const group = orderGroups.get(row.orderNumber) || [];
    group.push(row);
    orderGroups.set(row.orderNumber, group);
  }
  for (const group of orderGroups.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      row.requiresManualReview = true;
      row.messages.push("Pedido repetido na própria planilha");
    }
  }
  return result;
}

export function certisignOrderNumbers(rows: CertisignReconciliationRow[]) {
  return [...new Set(rows.filter((row) => row.valid && !row.ignored && row.orderNumber).map((row) => row.orderNumber))];
}
