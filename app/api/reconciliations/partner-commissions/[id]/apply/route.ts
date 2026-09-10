import { Prisma, ReconciliationKind } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { expectedPartnerCommission } from "@/lib/partner-commission-reconciliation";
import { requireSuperAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({ partnerId: z.string().cuid("Selecione um parceiro válido.") });
const sameMoney = (left: number, right: number) => Math.round(left * 100) === Math.round(right * 100);
const sameCompetence = (date: Date, competence: Date) => date.getUTCFullYear() === competence.getUTCFullYear() && date.getUTCMonth() === competence.getUTCMonth();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin();
  if (!user) return fail("UNAUTHORIZED", "Somente o Proprietário pode adicionar comissões de parceiros.", 403);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0].message);
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.reconciliationItem.findUnique({
        where: { id: (await params).id },
        include: { run: true, client: { include: { partner: true } } },
      });
      if (!item || item.run.kind !== ReconciliationKind.PARCEIROS) throw new Error("Linha de comissão não encontrada.");
      if (item.commissionAppliedAt) return { alreadyApplied: true, orderNumber: item.externalOrderNumber };
      if (!item.client || !item.client.purchaseDate) throw new Error("O pedido não está disponível para receber uma comissão.");
      if (!sameCompetence(item.client.purchaseDate, item.run.competence)) throw new Error("O pedido está em outra competência mensal.");
      if (!item.externalVendorCode) throw new Error("A planilha não informou o código de vendedor Certisign.");
      const externalCommission = item.externalCommissionAmount === null ? null : Number(item.externalCommissionAmount);
      if (externalCommission === null || externalCommission <= 0) throw new Error("Esta linha não possui comissão a adicionar.");
      const expectedCommission = expectedPartnerCommission(item.client.estimatedValue);
      if (expectedCommission === null || !sameMoney(externalCommission, expectedCommission)) throw new Error("A comissão Certisign não confere com os 10% calculados para este pedido.");
      const close = await transaction.financialClose.findUnique({ where: { month: item.run.competence }, select: { id: true } });
      if (close) throw new Error("O mês financeiro já foi fechado. Nenhuma comissão pode ser adicionada sem ajuste financeiro específico.");
      const partner = await transaction.partner.findUnique({ where: { id: parsed.data.partnerId }, select: { id: true, officeName: true, revCode: true } });
      if (!partner) throw new Error("Parceiro não encontrado.");
      const mapping = await transaction.certisignPartnerMapping.findUnique({ where: { externalVendorCode: item.externalVendorCode } });
      if (mapping && mapping.partnerId !== partner.id) throw new Error("Este código de vendedor Certisign já está vinculado a outro parceiro. A conciliação não altera mapeamentos existentes.");
      if (item.client.partnerId && item.client.partnerId !== partner.id) throw new Error("O pedido já está vinculado a outro parceiro; nenhum vínculo foi substituído.");
      if (!mapping) {
        await transaction.certisignPartnerMapping.create({ data: { externalVendorCode: item.externalVendorCode, externalVendorName: item.externalVendorName, partnerId: partner.id, createdById: user.id } });
      }
      if (!item.client.partnerId) {
        const updated = await transaction.client.updateMany({ where: { id: item.client.id, partnerId: null }, data: { partnerId: partner.id } });
        if (!updated.count) throw new Error("O parceiro deste pedido foi alterado por outra pessoa. Atualize a página e confira antes de tentar novamente.");
      }
      const appliedAt = new Date();
      const marked = await transaction.reconciliationItem.updateMany({
        where: { id: item.id, commissionAppliedAt: null },
        data: { commissionAppliedAt: appliedAt, commissionAppliedById: user.id, commissionAppliedPartnerId: partner.id },
      });
      if (!marked.count) return { alreadyApplied: true, orderNumber: item.externalOrderNumber };
      await transaction.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PARTNER_COMMISSION_LINKED",
          entity: "ReconciliationItem",
          entityId: item.id,
          details: { orderNumber: item.externalOrderNumber, externalVendorCode: item.externalVendorCode, partnerId: partner.id, partnerRevCode: partner.revCode, commission: externalCommission.toFixed(2), status: "Adição" } as Prisma.InputJsonValue,
        },
      });
      return { alreadyApplied: false, orderNumber: item.externalOrderNumber, partner: partner.officeName, commission: externalCommission };
    });
    return ok(result);
  } catch (error) {
    return fail("PARTNER_COMMISSION_APPLY_FAILED", error instanceof Error ? error.message : "Não foi possível adicionar a comissão.");
  }
}
