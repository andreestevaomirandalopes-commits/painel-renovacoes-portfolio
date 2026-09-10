import { ReconciliationReviewStatus } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  reviewStatus: z.nativeEnum(ReconciliationReviewStatus),
  reviewNote: z.string().trim().max(1200, "A observação pode ter no máximo 1.200 caracteres.").optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return fail("UNAUTHORIZED", "Apenas o Proprietário e administradores podem revisar conciliações.", 403);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0].message);
  const reviewNote = parsed.data.reviewNote || null;
  if (parsed.data.reviewStatus === ReconciliationReviewStatus.IGNORADO && !reviewNote) return fail("REVIEW_NOTE_REQUIRED", "Informe o motivo para ignorar esta linha.");
  try {
    const item = await prisma.reconciliationItem.update({
      where: { id: (await params).id },
      data: parsed.data.reviewStatus === ReconciliationReviewStatus.PENDENTE
        ? { reviewStatus: parsed.data.reviewStatus, reviewNote: null, reviewedAt: null, reviewedById: null }
        : { reviewStatus: parsed.data.reviewStatus, reviewNote, reviewedAt: new Date(), reviewedById: user.id },
      select: { id: true, reviewStatus: true, reviewNote: true, reviewedAt: true },
    });
    return ok(item);
  } catch {
    return fail("NOT_FOUND", "Linha de conciliação não encontrada.", 404);
  }
}
