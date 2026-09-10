import { createHash } from "crypto";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { emissionDateImportSummary, prepareEmissionDateImport } from "@/lib/emission-date-import";
import { emissionDateHeadersMissing, readEmissionDateWorkbook, validateEmissionDateRows } from "@/lib/spreadsheet/emission-dates";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const owner = await requireSuperAdmin();
  if (!owner) return fail("FORBIDDEN", "Apenas o Proprietário pode atualizar datas de emissão.", 403);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("INVALID_FILE", "Selecione uma planilha.");
    if (file.size > MAX_FILE_SIZE) return fail("FILE_TOO_LARGE", "O arquivo deve ter no máximo 5 MB.");
    if (!/\.(xlsx|csv)$/i.test(file.name)) return fail("INVALID_FILE", "Envie um arquivo .xlsx ou .csv.");

    const buffer = await file.arrayBuffer();
    const raw = readEmissionDateWorkbook(buffer);
    const missing = emissionDateHeadersMissing(raw);
    if (missing.length) return fail("MISSING_COLUMNS", `Colunas obrigatórias não reconhecidas: ${missing.join(", ")}`);

    const sourceRows = validateEmissionDateRows(raw);
    const clients = await prisma.client.findMany({
      select: { id: true, orderNumber: true, certificateType: true, issuedAt: true, expirationDate: true, renewalStage: true, status: true },
    });
    const items = prepareEmissionDateImport(sourceRows, clients);
    const summary = emissionDateImportSummary(items);
    const fileHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    const run = await prisma.emissionDateImportRun.create({
      data: {
        fileName: file.name,
        fileHash,
        importedById: owner.id,
        totalRows: items.length,
        updateCount: summary.updateCount,
        items: { create: items },
      },
    });

    return ok({ runId: run.id, rows: items, ...summary });
  } catch (error) {
    console.error("Emission date preview failed", error);
    return fail("IMPORT_PREVIEW_FAILED", "Não foi possível ler a planilha de datas de emissão.");
  }
}
