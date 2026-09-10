import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { cnpjAlertHeadersMissing, readCnpjAlertWorkbook, validateCnpjAlerts } from "@/lib/spreadsheet/cnpj-alerts";
import { requireAdmin } from "@/lib/permissions";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return fail("UNAUTHORIZED", "Apenas administradores podem importar alertas.", 403);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("INVALID_FILE", "Selecione uma planilha.");
    if (file.size > 5 * 1024 * 1024) return fail("FILE_TOO_LARGE", "O arquivo deve ter no máximo 5 MB.");
    if (!/\.(xlsx|csv)$/i.test(file.name)) return fail("INVALID_FILE", "Envie um arquivo .xlsx ou .csv.");

    const raw = readCnpjAlertWorkbook(await file.arrayBuffer());
    const missing = cnpjAlertHeadersMissing(raw);
    if (missing.length) return fail("MISSING_COLUMNS", `Colunas obrigatórias não reconhecidas: ${missing.join(", ")}`);

    const rows = validateCnpjAlerts(raw);
    const validCnpjs = [...new Set(rows.filter((row) => row.valid).map((row) => row.values.cnpj))];
    const existing = new Set((await prisma.cnpjAlert.findMany({ where: { cnpj: { in: validCnpjs } }, select: { cnpj: true } })).map((item) => item.cnpj));
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.valid) continue;
      if (seen.has(row.values.cnpj)) {
        row.valid = false;
        row.errors.push("CNPJ repetido na própria planilha");
      } else {
        seen.add(row.values.cnpj);
        row.existing = existing.has(row.values.cnpj);
      }
    }
    return ok({ rows, validCount: rows.filter((row) => row.valid).length, invalidCount: rows.filter((row) => !row.valid).length, existingCount: rows.filter((row) => row.valid && row.existing).length });
  } catch {
    return fail("IMPORT_PREVIEW_FAILED", "Não foi possível ler a planilha de alertas.");
  }
}
