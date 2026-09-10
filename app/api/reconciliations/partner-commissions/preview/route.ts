import { ReconciliationKind } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { assessPartnerCommission, partnerCommissionPreviewItem, preparePartnerCommissionReconciliation, type PartnerReference } from "@/lib/partner-commission-reconciliation";
import { MAX_RECONCILIATION_FILE_SIZE, parseReconciliationCompetence } from "@/lib/reconciliation-import";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return fail("UNAUTHORIZED", "Apenas o Proprietário e administradores podem importar conciliações.", 403);
  try {
    const form = await request.formData();
    const file = form.get("file");
    const competence = parseReconciliationCompetence(String(form.get("competence") || ""));
    if (!(file instanceof File)) return fail("INVALID_FILE", "Selecione a planilha de parceiros da Certisign.");
    if (!competence) return fail("INVALID_COMPETENCE", "Informe o mês de competência da planilha.");
    if (file.size > MAX_RECONCILIATION_FILE_SIZE || !/\.(xlsx|csv)$/i.test(file.name)) return fail("INVALID_FILE", "Envie um arquivo .xlsx ou .csv de até 5 MB.");

    const prepared = await preparePartnerCommissionReconciliation(file, competence);
    const clientIds = prepared.items.flatMap((item) => item.clientId ? [item.clientId] : []);
    const codes = [...new Set(prepared.items.flatMap((item) => item.externalVendorCode ? [item.externalVendorCode] : []))];
    const [clients, partners, mappings, close, existing] = await Promise.all([
      clientIds.length ? prisma.client.findMany({ where: { id: { in: clientIds } }, include: { partner: { select: { id: true, officeName: true, revCode: true } } } }) : Promise.resolve([]),
      prisma.partner.findMany({ select: { id: true, officeName: true, revCode: true } }),
      codes.length ? prisma.certisignPartnerMapping.findMany({ where: { externalVendorCode: { in: codes } }, include: { partner: { select: { id: true, officeName: true, revCode: true } } } }) : Promise.resolve([]),
      prisma.financialClose.findUnique({ where: { month: competence }, select: { id: true } }),
      prisma.reconciliationRun.findUnique({ where: { competence_kind_fileHash: { competence, kind: ReconciliationKind.PARCEIROS, fileHash: prepared.hash } }, select: { id: true } }),
    ]);
    const byClientId = new Map(clients.map((client) => [client.id, client]));
    const byPartnerRevCode = new Map(partners.map((partner) => [partner.revCode, partner]));
    const mappingByCode = new Map(mappings.map((mapping) => [mapping.externalVendorCode, mapping]));
    const previewItems = prepared.items.map((item) => {
      const mapping = item.externalVendorCode ? mappingByCode.get(item.externalVendorCode) : undefined;
      const suggestedPartner: PartnerReference | null = mapping?.partner || (item.externalVendorCode ? byPartnerRevCode.get(item.externalVendorCode) || null : null);
      const assessment = assessPartnerCommission({
        externalCommission: item.externalCommissionAmount,
        externalVendorCode: item.externalVendorCode,
        client: item.clientId ? byClientId.get(item.clientId) || null : null,
        competence,
        partnerByExternalCode: suggestedPartner,
        hasSavedMapping: Boolean(mapping),
        financialMonthClosed: Boolean(close),
      });
      return partnerCommissionPreviewItem(item, assessment);
    });
    const summary = previewItems.reduce<Record<string, number>>((result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    }, {});
    return ok({
      fileName: file.name,
      sheetName: prepared.sheetName,
      totalSourceRows: prepared.totalSourceRows,
      validSourceRows: prepared.validSourceRows,
      invalidSourceRows: prepared.invalidSourceRows,
      ignoredSourceRows: prepared.ignoredSourceRows,
      totalItems: prepared.totalItems,
      remuneratedItems: prepared.remuneratedItems,
      externalCommissionTotal: prepared.externalCommissionTotal,
      alreadyImported: Boolean(existing),
      existingRunId: existing?.id || null,
      summary,
      items: previewItems.slice(0, 100),
    });
  } catch (error) {
    console.error("Partner commission reconciliation preview failed", error);
    return fail("PARTNER_COMMISSION_PREVIEW_FAILED", error instanceof Error ? error.message : "Não foi possível ler a planilha de parceiros.");
  }
}
