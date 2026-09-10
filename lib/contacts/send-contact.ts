import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/templates";
import { sendEmail } from "@/lib/email/email.service";
import { sendWhatsApp } from "@/lib/whatsapp/whatsapp.service";
import { renewalEmailHtml } from "@/lib/email/renewal-email-template";

async function currentUserId() { const session = await auth(); const email = session?.user?.email; if (!email) return null; return (await prisma.user.findUnique({ where:{ email }, select:{ id:true } }))?.id || null; }
export async function sendContact(clientId: string, type: "EMAIL" | "WHATSAPP", automated = false) {
  const userId = automated ? (await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } }))?.id : await currentUserId();
  if (!userId) return { ok:false, code:"UNAUTHORIZED", message:"Sessão inválida." };
  const client = await prisma.client.findUnique({ where:{ id:clientId } }); if (!client) return { ok:false, code:"NOT_FOUND", message:"Cliente não encontrado." };
  const recipient = type === "EMAIL" ? client.email : client.phone; if (!recipient) return { ok:false, code:"MISSING_RECIPIENT", message:type === "EMAIL" ? "Cliente sem e-mail." : "Cliente sem telefone." };
  const template = type === "EMAIL" ? (process.env.EMAIL_TEMPLATE || "Olá {{nome}},\n\nSeu certificado {{produto}} vence em {{vencimento}}. Entre em contato para realizar sua renovação.") : (process.env.WHATSAPP_TEMPLATE || "Olá {{nome}}, seu certificado {{produto}} vence em {{vencimento}}. Entre em contato para realizar sua renovação.");
  const message = renderTemplate(template, client); const result = type === "EMAIL" ? await sendEmail({ recipient, subject:process.env.EMAIL_SUBJECT || "Renovação do certificado digital", message, html:renewalEmailHtml(client,message) }) : await sendWhatsApp({ phone:recipient, message });
  await prisma.contactLog.create({ data:{ clientId:client.id, userId, type, recipient, message, status:result.ok ? "SENT" : "FAILED", providerResponse:result.response.slice(0,2000) } });
  return result.ok ? { ok:true, message:type === "EMAIL" ? "E-mail enviado com sucesso." : "WhatsApp enviado com sucesso." } : { ok:false, code:"PROVIDER_ERROR", message:"Não foi possível enviar a mensagem. Verifique a configuração do provedor." };
}
