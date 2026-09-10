import { ReconciliationKind } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { MAX_RECONCILIATION_FILE_SIZE, parseReconciliationCompetence, prepareCertisignReconciliation, previewReconciliationItem } from "@/lib/reconciliation-import";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return fail("UNAUTHORIZED", "Apenas o Proprietário e administradores podem importar conciliações.", 403);
  try {
    const form = await request.formData();
    const file = form.get("file");
    const competenceValue = String(form.get("competence") || "");
    const competence = parseReconciliationCompetence(competenceValue);
    if (!(file instanceof File)) return fail("INVALID_FILE", "Selecione a planilha Certisign.");
    if (!competence) return fail("INVALID_COMPETENCE", "Informe o mês de competência da planilha.");
    if (file.size > MAX_RECONCILIATION_FILE_SIZE || !/\.(xlsx|csv)$/i.test(file.name)) return fail("INVALID_FILE", "Envie um arquivo .xlsx ou .csv de até 5 MB.");
    const prepared = await prepareCertisignReconciliation(file, competence);
    const existing = await prisma.reconciliationRun.findUnique({ where: { competence_kind_fileHash: { competence, kind: ReconciliationKind.PEDIDOS, fileHash: prepared.hash } }, select: { id: true, importedAt: true } });
    return ok({
      fileName: file.name,
      sheetName: prepared.sheetName,
      totalSourceRows: prepared.totalSourceRows,
      validSourceRows: prepared.validSourceRows,
      invalidSourceRows: prepared.invalidSourceRows,
      ignoredSourceRows: prepared.ignoredSourceRows,
      summary: prepared.summary,
      alreadyImported: Boolean(existing),
      existingRunId: existing?.id || null,
      items: prepared.items.slice(0, 100).map(previewReconciliationItem),
    });
  } catch (error) {
    console.error("Certisign reconciliation preview failed", error);
    return fail("RECONCILIATION_PREVIEW_FAILED", error instanceof Error ? error.message : "Não foi possível ler a planilha Certisign.");
  }
}
