import { demoModeMessage, isDemoMode } from "@/lib/demo-mode";

export type SendResult = { ok: boolean; response: string };
export async function sendEmail({ recipient, subject, message, html }: { recipient: string; subject: string; message: string; html?: string }): Promise<SendResult> {
  if (isDemoMode()) return { ok: false, response: demoModeMessage };
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok:false, response:"Resend não configurado. Defina RESEND_API_KEY e EMAIL_FROM." };
  const sender = process.env.EMAIL_SENDER_NAME ? `${process.env.EMAIL_SENDER_NAME} <${from}>` : from;
  const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:`Bearer ${apiKey}`, "Content-Type":"application/json", "User-Agent":"painel-renovacoes/1.0" }, body:JSON.stringify({ from:sender, to:[recipient], subject, text:message, ...(html?{html}:{}) }) });
  return { ok: response.ok, response: await response.text() };
}
