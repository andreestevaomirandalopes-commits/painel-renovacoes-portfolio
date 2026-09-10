import { Prisma, ReconciliationKind } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { MAX_RECONCILIATION_FILE_SIZE, parseReconciliationCompetence, prepareCertisignReconciliation } from "@/lib/reconciliation-import";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return fail("UNAUTHORIZED", "Apenas o Proprietário e administradores podem importar conciliações.", 403);
  try {
    const form = await request.formData();
    const file = form.get("file");
    const competenceValue = String(form.get("competence") || "");
    const competence = parseReconciliationCompetence(competenceValue);
    if (!(file instanceof File)) return fail("INVALID_FILE", "Selecione a planilha Certisign.");
    if (!competence) return fail("INVALID_COMPETENCE", "Informe o mês de competência da planilha.");
    if (file.size > MAX_RECONCILIATION_FILE_SIZE || !/\.(xlsx|csv)$/i.test(file.name)) return fail("INVALID_FILE", "Envie um arquivo .xlsx ou .csv de até 5 MB.");
    const prepared = await prepareCertisignReconciliation(file, competence);
    const existing = await prisma.reconciliationRun.findUnique({ where: { competence_kind_fileHash: { competence, kind: ReconciliationKind.PEDIDOS, fileHash: prepared.hash } }, select: { id: true } });
    if (existing) return fail("DUPLICATE_IMPORT", "Esta mesma planilha já foi importada para esta competência.", 409);
    const run = await prisma.$transaction(async (transaction) => {
      const created = await transaction.reconciliationRun.create({
        data: {
          competence,
          kind: ReconciliationKind.PEDIDOS,
          fileName: file.name,
          sheetName: prepared.sheetName,
          fileHash: prepared.hash,
          importedById: user.id,
          totalSourceRows: prepared.totalSourceRows,
          validSourceRows: prepared.validSourceRows,
          invalidSourceRows: prepared.invalidSourceRows,
          ignoredSourceRows: prepared.ignoredSourceRows,
          totalItems: prepared.items.length,
        },
      });
      await transaction.reconciliationItem.createMany({
        data: prepared.items.map((item) => ({
          ...item,
          runId: created.id,
          rawData: item.rawData ? item.rawData as Prisma.InputJsonValue : undefined,
          differences: item.differences as unknown as Prisma.InputJsonValue,
        })),
      });
      return created;
    });
    return ok({ runId: run.id, totalItems: prepared.items.length }, 201);
  } catch (error) {
    console.error("Certisign reconciliation import failed", error);
    return fail("RECONCILIATION_IMPORT_FAILED", error instanceof Error ? error.message : "Não foi possível salvar a conciliação.");
  }
}
