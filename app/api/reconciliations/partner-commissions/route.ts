import { Prisma, ReconciliationKind } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { preparePartnerCommissionReconciliation } from "@/lib/partner-commission-reconciliation";
import { MAX_RECONCILIATION_FILE_SIZE, parseReconciliationCompetence } from "@/lib/reconciliation-import";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return fail("UNAUTHORIZED", "Apenas o Proprietário e administradores podem importar conciliações.", 403);
  try {
    const form = await request.formData();
    const file = form.get("file");
    const competence = parseReconciliationCompetence(String(form.get("competence") || ""));
    if (!(file instanceof File)) return fail("INVALID_FILE", "Selecione a planilha de parceiros da Certisign.");
    if (!competence) return fail("INVALID_COMPETENCE", "Informe o mês de competência da planilha.");
    if (file.size > MAX_RECONCILIATION_FILE_SIZE || !/\.(xlsx|csv)$/i.test(file.name)) return fail("INVALID_FILE", "Envie um arquivo .xlsx ou .csv de até 5 MB.");
    const prepared = await preparePartnerCommissionReconciliation(file, competence);
    const existing = await prisma.reconciliationRun.findUnique({ where: { competence_kind_fileHash: { competence, kind: ReconciliationKind.PARCEIROS, fileHash: prepared.hash } }, select: { id: true } });
    if (existing) return fail("DUPLICATE_IMPORT", "Esta mesma planilha de parceiros já foi importada para esta competência.", 409);
    const run = await prisma.$transaction(async (transaction) => {
      const created = await transaction.reconciliationRun.create({
        data: {
          competence,
          kind: ReconciliationKind.PARCEIROS,
          fileName: file.name,
          sheetName: prepared.sheetName,
          fileHash: prepared.hash,
          importedById: user.id,
          totalSourceRows: prepared.totalSourceRows,
          validSourceRows: prepared.validSourceRows,
          invalidSourceRows: prepared.invalidSourceRows,
          ignoredSourceRows: prepared.ignoredSourceRows,
          totalItems: prepared.totalItems,
        },
      });
      await transaction.reconciliationItem.createMany({
        data: prepared.items.map((item) => ({
          ...item,
          runId: created.id,
          // A planilha contém uma seção com PIX no rodapé. O fluxo de parceiros
          // guarda somente os campos explicitamente exibidos e nunca o dado bruto.
          rawData: undefined,
          differences: item.differences as unknown as Prisma.InputJsonValue,
        })),
      });
      return created;
    });
    return ok({ runId: run.id, totalItems: prepared.totalItems, remuneratedItems: prepared.remuneratedItems }, 201);
  } catch (error) {
    console.error("Partner commission reconciliation import failed", error);
    return fail("PARTNER_COMMISSION_IMPORT_FAILED", error instanceof Error ? error.message : "Não foi possível salvar a conciliação de parceiros.");
  }
}
