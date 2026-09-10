export type CertificateTypeInput = "A1" | "A3";

export function calculateExpirationDate(purchaseDate: string, certificateType: CertificateTypeInput) {
  if (!purchaseDate) return "";
  const [year, month, day] = purchaseDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const monthsToAdd = certificateType === "A1" ? 12 : 30;
  const targetMonth = month - 1 + monthsToAdd;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  const result = new Date(year, targetMonth, Math.min(day, lastDay));
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

/**
 * Normaliza uma data de calendário para meio-dia UTC. Assim, uma data vinda
 * de uma planilha não muda de dia ao ser exibida em servidores de outro fuso.
 */
export function calendarDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12));
}

/** Calcula o vencimento real a partir da data de emissão do certificado. */
export function expirationFromEmissionDate(issuedAt: Date, certificateType: CertificateTypeInput) {
  const result = calendarDate(issuedAt);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + (certificateType === "A1" ? 12 : 30));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}
