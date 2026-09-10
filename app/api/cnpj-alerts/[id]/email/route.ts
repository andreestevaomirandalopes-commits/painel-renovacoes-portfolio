import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { cnpjAlertEmailContent, cnpjAlertEmailHtml } from "@/lib/email/cnpj-alert-email-template";
import { sendEmail } from "@/lib/email/email.service";

async function getAlert(id: string) {
  return prisma.cnpjAlert.findUnique({ where: { id } });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("UNAUTHORIZED", "Apenas administradores podem visualizar a prévia.", 403);
  const alert = await getAlert((await params).id);
  if (!alert) return fail("NOT_FOUND", "Alerta não encontrado.", 404);
  return ok({ ...cnpjAlertEmailContent(alert), recipient: alert.email, canSend: Boolean(alert.email) && alert.status === "APROVADO_CONTATO" && !alert.doNotContact });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return fail("UNAUTHORIZED", "Apenas administradores podem enviar e-mails.", 403);
  const alert = await getAlert((await params).id);
  if (!alert) return fail("NOT_FOUND", "Alerta não encontrado.", 404);
  if (alert.doNotContact) return fail("CONTACT_BLOCKED", "Este contato solicitou não receber novas mensagens.");
  if (alert.status !== "APROVADO_CONTATO") return fail("NOT_APPROVED", "Aprove o contato antes de enviar o e-mail.");
  if (!alert.email) return fail("MISSING_EMAIL", "Este alerta não possui e-mail cadastrado.");

  const { subject, message } = cnpjAlertEmailContent(alert);
  const result = await sendEmail({ recipient: alert.email, subject, message, html: cnpjAlertEmailHtml(alert, message) });
  await prisma.$transaction(async (tx) => {
    await tx.cnpjAlertContactLog.create({ data: { alertId: alert.id, userId: user.id, recipient: alert.email!, subject, message, status: result.ok ? "SENT" : "FAILED", providerResponse: result.response } });
    await tx.cnpjAlertActivity.create({ data: { alertId: alert.id, actorUserId: user.id, action: result.ok ? "EMAIL_SENT" : "EMAIL_FAILED", details: { recipient: alert.email, response: result.response } } });
    if (result.ok) await tx.cnpjAlert.update({ where: { id: alert.id }, data: { status: "CONTATADO", contactSentAt: new Date() } });
  });
  return result.ok ? ok({ message: "E-mail enviado e contato registrado." }) : fail("SEND_FAILED", "O e-mail não foi enviado. Verifique a configuração do Resend.");
}
