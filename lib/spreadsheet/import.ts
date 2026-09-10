import * as XLSX from "xlsx";
import { clientSchema } from "@/lib/validations/client";

type SheetRow = Record<string, unknown>;
export type PreviewRow = { line: number; values: Record<string, string>; valid: boolean; errors: string[]; duplicate?: boolean };

const aliases: Record<string, string[]> = {
  orderNumber: ["pedido", "pedido gar", "pedido certisign", "n pedido", "numero pedido", "numero do pedido", "numero pedido cliente", "numero da proposta", "proposta"],
  name: ["cliente", "ds cliente", "nome", "nome cliente"], validationPost: ["posto validacao", "posto de validacao"],
  productType: ["produto", "tipo produto", "tipo do produto"], cpf: ["cpf", "cd cpf gar"], cnpj: ["cnpj", "cd cnpj gar"],
  certificateType: ["certificado", "tipo certificado", "tipo de certificado"], a3Model: ["modelo a3", "modelo", "modelo certificado"],
  productDescription: ["produto gar", "descricao produto", "produto descricao"], personType: ["pessoa", "tipo pessoa"],
  orderStatus: ["ds status pedido", "status pedido", "status do pedido"], validationType: ["tipo validacao", "tipo de validacao"], legalName: ["ds razao social", "razao social"],
  renewalCode: ["codrev", "codigo renovacao", "codigo de renovacao"], renewal30Days: ["30 dias"], renewal60Days: ["60 dias"], renewal90Days: ["90 dias"], isRenewal: ["renovacoes", "renovacao"],
  issuedAt: ["data emissao", "data de emissao", "emissao", "emissao certificado", "data emissao certificado", "data de emissao certificado"], purchaseDate: ["data compra", "data de compra", "compra"], expirationDate: ["vencimento", "data vencimento", "data de vencimento", "data expiracao", "data de expiracao", "validade"],
  email: ["email", "e mail", "e mail cliente", "email cliente"], phone: ["telefone", "celular", "whatsapp", "nr telefone"],
};
const key = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const text = (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim();
const mappedField = (header: string) => { const normalized = key(header); return Object.entries(aliases).find(([, names]) => names.includes(normalized))?.[0]; };
const normalizedEnum = (value: string) => key(value).replace(/ /g, "_").replace(/^E_?/, "E_").toUpperCase();
const normalizeDate = (value: string) => { const br = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); return br ? `${br[3]}-${br[2].padStart(2,"0")}-${br[1].padStart(2,"0")}` : value; };
const booleanValue = (value: string) => ["true", "sim", "1", "x"].includes(key(value));
const normalizeDocument = (value: string, length: number) => { const digits = value.replace(/\D/g, ""); return digits.length === length - 1 ? `0${digits}` : digits; };

export function readWorkbook(buffer: ArrayBuffer): SheetRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "", raw: true, dateNF: "yyyy-mm-dd" });
}
export function normalizeRow(row: SheetRow) {
  const result: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) { const field = mappedField(header); if (field) result[field] = text(value); }
  result.productType = normalizedEnum(result.productType || ""); result.certificateType = (result.certificateType || "").toUpperCase(); result.a3Model = (result.a3Model || "").toUpperCase();
  result.issuedAt = normalizeDate(result.issuedAt || ""); result.purchaseDate = normalizeDate(result.purchaseDate || ""); result.expirationDate = normalizeDate(result.expirationDate || "");
  result.cpf = normalizeDocument(result.cpf || "", 11); result.cnpj = normalizeDocument(result.cnpj || "", 14);
  for (const field of ["renewal30Days", "renewal60Days", "renewal90Days", "isRenewal"]) result[field] = String(booleanValue(result[field] || ""));
  if (result.phone === "0") result.phone = ""; if (result.cnpj === "0") result.cnpj = "";
  return result;
}
const schemaInput = (values: Record<string,string>, allowMissingA3Model=false) => ({ ...values, cnpj: values.cnpj || null, a3Model: values.a3Model || (allowMissingA3Model && values.certificateType === "A3" ? "TOKEN" : null), phone: values.phone || null, issuedAt: values.issuedAt || null, purchaseDate: values.purchaseDate || null, renewal30Days: values.renewal30Days === "true", renewal60Days: values.renewal60Days === "true", renewal90Days: values.renewal90Days === "true", isRenewal: values.isRenewal === "true" });
export function parseClient(values: Record<string,string>) { const parsed = clientSchema.safeParse(schemaInput(values, true)); if (!parsed.success) return parsed; return { success: true as const, data: { ...parsed.data, a3Model: values.a3Model ? parsed.data.a3Model : null } }; }
export function validateRows(rows: SheetRow[]): PreviewRow[] { return rows.map((raw, index) => { const values = normalizeRow(raw); const parsed = parseClient(values); return { line: index + 2, values, valid: parsed.success, errors: parsed.success ? [] : parsed.error.issues.map(issue => issue.message) }; }); }
export function requiredHeadersMissing(rows: SheetRow[]) { if (!rows.length) return ["A planilha está vazia"]; const found = new Set(Object.keys(rows[0]).map(mappedField).filter(Boolean)); return ["orderNumber", "productType", "cpf", "certificateType", "expirationDate", "email"].filter(field => !found.has(field)); }
export function extractOrderNumbers(rows: SheetRow[]) { const orders = new Set<string>(); for (const row of rows) for (const [header, value] of Object.entries(row)) if (mappedField(header) === "orderNumber") { const order = text(value); if (order && order !== "0") orders.add(order); } return [...orders]; }
