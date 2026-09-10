import type { CnpjAlert } from "@prisma/client";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const defaultMessage = "Olá, {{razaoSocial}}!\\n\\nIdentificamos que sua empresa foi aberta recentemente. Nossa equipe pode ajudar com o certificado digital da sua empresa.\\n\\nFale conosco para saber mais.";

export function cnpjAlertEmailContent(alert: CnpjAlert) {
  const template = process.env.NEW_CNPJ_EMAIL_TEMPLATE || defaultMessage;
  const values: Record<string, string> = {
    cnpj: alert.cnpj,
    razaoSocial: alert.legalName,
    nomeFantasia: alert.tradeName || alert.legalName,
    cidade: alert.city,
    uf: alert.state,
    cnae: alert.cnae || "",
    dataAbertura: alert.openingDate ? alert.openingDate.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "",
  };
  const message = template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => values[key] ?? "");
  const subject = (process.env.NEW_CNPJ_EMAIL_SUBJECT || "Certificado digital para sua empresa")
    .replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => values[key] ?? "");
  return { subject, message };
}

export function cnpjAlertEmailHtml(alert: CnpjAlert, message: string) {
  const color = process.env.EMAIL_BRAND_COLOR || "#087a98";
  const content = escapeHtml(message).replace(/\n/g, "<br />");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden"><tr><td style="background:${color};padding:22px 30px;color:#fff"><strong style="font-size:20px">Painel de Gestão</strong></td></tr><tr><td style="padding:30px"><p style="margin:0 0 18px;font-size:16px;line-height:1.65">${content}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px"><tr><td style="padding:16px;font-size:14px;line-height:1.7"><strong>Empresa:</strong> ${escapeHtml(alert.legalName)}<br /><strong>CNPJ:</strong> ${escapeHtml(alert.cnpj)}${alert.city ? `<br /><strong>Localização:</strong> ${escapeHtml(alert.city)} - ${escapeHtml(alert.state)}` : ""}</td></tr></table></td></tr></table></td></tr></table></body></html>`;
}
