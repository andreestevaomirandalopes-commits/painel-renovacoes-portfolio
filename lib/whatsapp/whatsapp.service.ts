import type { SendResult } from "@/lib/email/email.service";
import { demoModeMessage, isDemoMode } from "@/lib/demo-mode";
const normalizedPhone = (phone: string) => { const digits = phone.replace(/\D/g, ""); return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits; };
export async function sendWhatsApp({ phone, message }: { phone: string; message: string }): Promise<SendResult> {
  if (isDemoMode()) return { ok: false, response: demoModeMessage };
  const token = process.env.WHATSAPP_ACCESS_TOKEN; const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID; const version = process.env.WHATSAPP_API_VERSION;
  if (!token || !phoneNumberId || !version) return { ok:false, response:"WhatsApp não configurado. Defina WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_API_VERSION." };
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME; const payload = templateName ? { messaging_product:"whatsapp", to:normalizedPhone(phone), type:"template", template:{ name:templateName, language:{ code:process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR" }, components:[{ type:"body", parameters:[{ type:"text", text:message }] }] } } : { messaging_product:"whatsapp", to:normalizedPhone(phone), type:"text", text:{ body:message } };
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" }, body:JSON.stringify(payload) });
  return { ok:response.ok, response:await response.text() };
}
