import { CnpjAlertStatus } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

const schema = z.object({
  status: z.nativeEnum(CnpjAlertStatus).optional(),
  doNotContact: z.boolean().optional(),
});

const editableStatuses = new Set<CnpjAlertStatus>(["NOVO", "EM_ANALISE", "APROVADO_CONTATO", "DESCARTADO"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return fail("UNAUTHORIZED", "Apenas administradores podem alterar alertas.", 403);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || (parsed.data.status === undefined && parsed.data.doNotContact === undefined)) return fail("INVALID_REQUEST", "Informe uma alteração válida.");
  const id = (await params).id;
  const current = await prisma.cnpjAlert.findUnique({ where: { id } });
  if (!current) return fail("NOT_FOUND", "Alerta não encontrado.", 404);
  if (parsed.data.status && !editableStatuses.has(parsed.data.status)) return fail("INVALID_STATUS", "O status Contatado é definido somente após o envio do e-mail.");

  const doNotContact = parsed.data.doNotContact ?? current.doNotContact;
  const status = doNotContact ? "DESCARTADO" : (parsed.data.status ?? current.status);
  if (doNotContact && status === "APROVADO_CONTATO") return fail("CONTACT_BLOCKED", "Este contato está marcado como não autorizado.");

  const alert = await prisma.$transaction(async (tx) => {
    const updated = await tx.cnpjAlert.update({ where: { id }, data: { status, doNotContact } });
    await tx.cnpjAlertActivity.create({ data: { alertId: id, actorUserId: user.id, action: "ALERT_STATUS_UPDATED", details: { previousStatus: current.status, status, doNotContact } } });
    return updated;
  });
  return ok(alert);
}
