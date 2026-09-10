import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { importOpeningDate, isValidCnpj, normalizeCnpj, type CnpjAlertPreviewRow } from "@/lib/spreadsheet/cnpj-alerts";
import { requireAdmin } from "@/lib/permissions";

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return fail("UNAUTHORIZED", "Apenas administradores podem importar alertas.", 403);
  try {
    const { rows } = await request.json() as { rows?: CnpjAlertPreviewRow[] };
    if (!Array.isArray(rows) || !rows.some((row) => row.valid)) return fail("INVALID_IMPORT", "Não há alertas válidos para importar.");
    let created = 0;
    let updated = 0;
    const skipped: { line: number; reason: string }[] = [];

    for (const row of rows) {
      if (!row.valid) continue;
      const values = row.values;
      try {
        const cnpj = normalizeCnpj(values.cnpj);
        if (!isValidCnpj(cnpj) || !values.legalName || !values.city || !/^[A-Z]{2}$/.test(values.state) || !importOpeningDate(values.openingDate)) {
          skipped.push({ line: row.line, reason: "Dados obrigatórios inválidos" });
          continue;
        }
        if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) {
          skipped.push({ line: row.line, reason: "E-mail inválido" });
          continue;
        }
        const existing = await prisma.cnpjAlert.findUnique({ where: { cnpj }, select: { id: true } });
        const data = {
          legalName: values.legalName,
          tradeName: values.tradeName || null,
          openingDate: importOpeningDate(values.openingDate),
          registrationStatus: values.registrationStatus || null,
          cnae: values.cnae || null,
          city: values.city,
          state: values.state,
          email: values.email || null,
          phone: values.phone || null,
          source: values.source || "Importação manual",
        };
        if (existing) {
          await prisma.$transaction([
            prisma.cnpjAlert.update({ where: { id: existing.id }, data }),
            prisma.cnpjAlertActivity.create({ data: { alertId: existing.id, actorUserId: user.id, action: "ALERT_UPDATED_BY_IMPORT", details: { source: data.source } } }),
          ]);
          updated++;
        } else {
          const alert = await prisma.cnpjAlert.create({ data: { cnpj, ...data } });
          await prisma.cnpjAlertActivity.create({ data: { alertId: alert.id, actorUserId: user.id, action: "ALERT_CREATED", details: { source: data.source, method: "IMPORT" } } });
          created++;
        }
      } catch {
        skipped.push({ line: row.line, reason: "Não foi possível salvar este CNPJ" });
      }
    }
    return ok({ created, updated, skipped });
  } catch {
    return fail("IMPORT_FAILED", "Não foi possível concluir a importação de alertas.");
  }
}
