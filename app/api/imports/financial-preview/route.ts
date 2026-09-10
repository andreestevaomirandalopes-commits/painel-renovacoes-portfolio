import { fail, ok } from "@/lib/api";
import { extractOrderNumbers, readWorkbook } from "@/lib/spreadsheet/import";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const files = form.getAll("files");
    if (!files.length || files.some(file => !(file instanceof File))) return fail("INVALID_FILE", "Selecione ao menos uma planilha financeira.");
    const uploaded = files as File[];
    if (uploaded.some(file => file.size > 5 * 1024 * 1024 || !/\.(xlsx|csv)$/i.test(file.name))) return fail("INVALID_FILE", "Envie somente arquivos .xlsx ou .csv de até 5 MB.");
    const financialOrders = new Set<string>();
    for (const file of uploaded) for (const order of extractOrderNumbers(readWorkbook(await file.arrayBuffer()))) financialOrders.add(order);
    if (!financialOrders.size) return fail("ORDER_COLUMN_NOT_FOUND", "Não foi encontrada uma coluna de pedido. Use cabeçalhos como Pedido, Nº Pedido, Pedido GAR ou Pedido Certisign.");
    const clients = await prisma.client.findMany({ select: { orderNumber: true, name: true, legalName: true, email: true, productType: true, expirationDate: true } });
    const systemOrders = new Set(clients.map(client => client.orderNumber));
    const missingFromFinancial = clients.filter(client => !financialOrders.has(client.orderNumber));
    const notRegistered = [...financialOrders].filter(order => !systemOrders.has(order));
    return ok({ files: uploaded.map(file => file.name), financialOrders: financialOrders.size, systemOrders: systemOrders.size, matched: financialOrders.size - notRegistered.length, missingFromFinancial: missingFromFinancial.slice(0,500), missingTotal: missingFromFinancial.length, notRegistered: notRegistered.slice(0,500), notRegisteredTotal: notRegistered.length });
  } catch (error) { console.error("Financial reconciliation failed", error); return fail("FINANCIAL_RECONCILIATION_FAILED", "Não foi possível conferir as planilhas financeiras."); }
}
