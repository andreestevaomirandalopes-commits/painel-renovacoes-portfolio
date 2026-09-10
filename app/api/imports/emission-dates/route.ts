import { z } from "zod";
import { EmissionDateImportItemStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { calculateCertificateStatus } from "@/lib/status";
import { prepareEmissionDateImport, sameCalendarDate } from "@/lib/emission-date-import";

const inputSchema = z.object({ runId: z.string().cuid() });

export async function POST(request: Request) {
  const owner = await requireSuperAdmin();
  if (!owner) return fail("FORBIDDEN", "Apenas o Proprietário pode confirmar esta atualização.", 403);

  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return fail("INVALID_IMPORT", "Prévia de importação inválida.");

  const claimed = await prisma.emissionDateImportRun.updateMany({
    where: { id: parsed.data.runId, importedById: owner.id, status: "PREVIA" },
    data: { status: "APLICANDO" },
  });
  if (!claimed.count) return fail("IMPORT_UNAVAILABLE", "Esta prévia já foi aplicada, expirou ou não pertence ao seu usuário.", 409);

  let applied = 0;
  let skipped = 0;
  try {
    const run = await prisma.emissionDateImportRun.findUnique({
      where: { id: parsed.data.runId },
      include: { items: { orderBy: { sourceLine: "asc" } } },
    });
    if (!run) throw new Error("Prévia não encontrada após bloqueio.");

    const sourceRows = run.items.map((item) => ({
      line: item.sourceLine,
      orderNumber: item.sourceOrderNumber,
      issuedAt: item.sourceIssuedAt,
      sourceExpirationDate: item.sourceExpirationDate,
      errors: item.status === "DATA_INVALIDA" ? [item.message || "Dados de data inválidos"] : [],
    }));
    const clients = await prisma.client.findMany({
      select: { id: true, orderNumber: true, certificateType: true, issuedAt: true, expirationDate: true, renewalStage: true, status: true },
    });
    const prepared = prepareEmissionDateImport(sourceRows, clients);
    const originalByLine = new Map(run.items.map((item) => [item.sourceLine, item]));
    for (const item of prepared) {
      const original = originalByLine.get(item.sourceLine);
      if (!original) continue;

      if (item.status !== EmissionDateImportItemStatus.ATUALIZAR || !item.clientId || !item.sourceIssuedAt || !item.calculatedExpirationDate) {
        await prisma.emissionDateImportItem.update({
          where: { id: original.id },
          data: { status: item.status, message: item.message },
        });
        skipped++;
        continue;
      }

      const changedSincePreview = !sameCalendarDate(original.previousIssuedAt, item.previousIssuedAt) || !sameCalendarDate(original.previousExpirationDate, item.previousExpirationDate);
      if (changedSincePreview) {
        const alreadyUpdated = sameCalendarDate(item.previousIssuedAt, item.sourceIssuedAt) && sameCalendarDate(item.previousExpirationDate, item.calculatedExpirationDate);
        await prisma.emissionDateImportItem.update({
          where: { id: original.id },
          data: {
            status: alreadyUpdated ? "SEM_ALTERACAO" : "CONFLITO",
            message: alreadyUpdated ? "As datas já foram atualizadas desde a prévia; nenhuma nova alteração foi feita." : "O pedido foi alterado desde a prévia; nenhuma informação foi sobrescrita.",
          },
        });
        skipped++;
        continue;
      }

      const sourceIssuedAt = item.sourceIssuedAt;
      const calculatedExpirationDate = item.calculatedExpirationDate;
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.client.updateMany({
          where: {
            id: item.clientId!,
            issuedAt: item.previousIssuedAt,
            expirationDate: item.previousExpirationDate!,
            renewalStage: { not: "RENOVADO" },
            status: { not: "RENOVADO" },
          },
          data: {
            issuedAt: sourceIssuedAt,
            expirationDate: calculatedExpirationDate,
            status: calculateCertificateStatus(calculatedExpirationDate),
          },
        });
        if (!result.count) return false;

        await tx.emissionDateImportItem.update({
          where: { id: original.id },
          data: { status: "ATUALIZADO", message: "Data de emissão e vencimento atualizados com segurança.", appliedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: owner.id,
            action: "CLIENT_EMISSION_DATE_IMPORTED",
            entity: "Client",
            entityId: item.clientId,
            details: {
              orderNumber: item.matchedOrderNumber,
              sourceLine: item.sourceLine,
              previousIssuedAt: original.previousIssuedAt?.toISOString() || null,
              issuedAt: sourceIssuedAt.toISOString(),
              previousExpirationDate: original.previousExpirationDate?.toISOString() || null,
              expirationDate: calculatedExpirationDate.toISOString(),
              status: "Edição",
            },
          },
        });
        return true;
      });

      if (updated) applied++;
      else {
        await prisma.emissionDateImportItem.update({
          where: { id: original.id },
          data: { status: "CONFLITO", message: "O pedido mudou durante a confirmação; nenhuma informação foi sobrescrita." },
        });
        skipped++;
      }
    }

    await prisma.emissionDateImportRun.update({
      where: { id: run.id },
      data: { status: "CONCLUIDO", appliedAt: new Date(), appliedCount: applied, skippedCount: skipped },
    });
    return ok({ applied, skipped, total: run.totalRows });
  } catch (error) {
    console.error("Emission date import apply failed", error);
    await prisma.emissionDateImportRun.updateMany({
      where: { id: parsed.data.runId, importedById: owner.id, status: "APLICANDO" },
      data: { status: "FALHOU", appliedCount: applied, skippedCount: skipped },
    });
    return fail("IMPORT_FAILED", applied ? `A importação foi interrompida após ${applied} atualização(ões), todas registradas com auditoria. Crie uma nova prévia para revisar as demais linhas.` : "Não foi possível confirmar a atualização. Nenhum pedido foi alterado.");
  }
}
