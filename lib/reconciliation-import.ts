import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { prepareReconciliationItems, reconciliationSummary, type ReconciliationPreparedItem } from "@/lib/reconciliation";
import { certisignHeadersMissing, certisignOrderNumbers, readCertisignWorkbook, validateCertisignRows } from "@/lib/spreadsheet/certisign-reconciliation";

export const MAX_RECONCILIATION_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_RECONCILIATION_ROWS = 5000;

export function parseReconciliationCompetence(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

export function endOfReconciliationCompetence(competence: Date) {
  return new Date(Date.UTC(competence.getUTCFullYear(), competence.getUTCMonth() + 1, 1));
}

export function competenceLabel(competence: Date) {
  return `${competence.getUTCFullYear()}-${String(competence.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function prepareCertisignReconciliation(file: File, competence: Date) {
  const buffer = await file.arrayBuffer();
  const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const { sheetName, rows: workbookRows } = readCertisignWorkbook(buffer);
  if (workbookRows.length > MAX_RECONCILIATION_ROWS) throw new Error(`A planilha pode ter no máximo ${MAX_RECONCILIATION_ROWS.toLocaleString("pt-BR")} linhas.`);
  const missing = certisignHeadersMissing(workbookRows);
  if (missing.length) throw new Error(`Coluna obrigatória não reconhecida: ${missing.join(", ")}.`);
  const rows = validateCertisignRows(workbookRows);
  const orderNumbers = certisignOrderNumbers(rows);
  const end = endOfReconciliationCompetence(competence);
  const [clientsInCompetence, sourceClients, partners] = await Promise.all([
    prisma.client.findMany({ where: { purchaseDate: { gte: competence, lt: end } }, include: { partner: { select: { revCode: true, officeName: true } } } }),
    orderNumbers.length ? prisma.client.findMany({ where: { orderNumber: { in: orderNumbers } }, include: { partner: { select: { revCode: true, officeName: true } } } }) : Promise.resolve([]),
    prisma.partner.findMany({ select: { revCode: true } }),
  ]);
  const items = prepareReconciliationItems({ rows, clientsInCompetence, allSourceClients: sourceClients, knownPartnerCodes: partners.map((partner) => partner.revCode) });
  return {
    hash,
    sheetName,
    rows,
    items,
    summary: reconciliationSummary(items),
    totalSourceRows: rows.length,
    validSourceRows: rows.filter((row) => row.valid && !row.ignored).length,
    invalidSourceRows: rows.filter((row) => !row.valid && !row.ignored).length,
    ignoredSourceRows: rows.filter((row) => row.ignored).length,
  };
}

export function previewReconciliationItem(item: ReconciliationPreparedItem) {
  return {
    sourceLine: item.sourceLine,
    status: item.status,
    externalOrderNumber: item.externalOrderNumber,
    systemOrderNumber: item.systemOrderNumber,
    systemClientName: item.systemClientName,
    systemCpf: item.systemCpf,
    systemCnpj: item.systemCnpj,
    externalProductName: item.externalProductName,
    systemProductType: item.systemProductType,
    systemCertificateType: item.systemCertificateType,
    systemValue: item.systemValue,
    externalBillingAmount: item.externalBillingAmount,
    differences: item.differences,
  };
}
