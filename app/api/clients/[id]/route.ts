import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validations/client";
import { calendarDate, expirationFromEmissionDate } from "@/lib/certificates";
import { calculateCertificateStatus } from "@/lib/status";
import { fail, ok } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/permissions";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await prisma.client.findUnique({ where: { id: (await params).id } });
  return client ? ok(client) : fail("NOT_FOUND", "Cliente não encontrado", 404);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireSuperAdmin();
  if (!owner) return fail("FORBIDDEN", "Apenas o Proprietário pode editar cadastros.", 403);

  const parsed = clientSchema.safeParse(await req.json());
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0].message);

  const value = parsed.data;
  const issuedAt = value.issuedAt ? calendarDate(value.issuedAt) : null;
  const expirationDate = issuedAt ? expirationFromEmissionDate(issuedAt, value.certificateType) : value.expirationDate;

  try {
    const id = (await params).id;
    const client = await prisma.client.update({
      where: { id },
      data: {
        ...value,
        issuedAt,
        expirationDate,
        cnpj: value.cnpj || null,
        a3Model: value.certificateType === "A1" ? null : value.a3Model!,
        status: calculateCertificateStatus(expirationDate),
      },
    });
    await audit({
      actorUserId: owner.id,
      action: "CLIENT_UPDATED",
      entity: "Client",
      entityId: id,
      details: { orderNumber: client.orderNumber, issuedAt: client.issuedAt?.toISOString() || null },
    });
    return ok(client);
  } catch {
    return fail("NOT_FOUND", "Cliente não encontrado", 404);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireSuperAdmin();
  if (!owner) return fail("FORBIDDEN", "Apenas o Proprietário pode excluir cadastros.", 403);
  try {
    const id = (await params).id;
    const client = await prisma.client.delete({ where: { id } });
    await audit({ actorUserId: owner.id, action: "CLIENT_DELETED", entity: "Client", entityId: id, details: { orderNumber: client.orderNumber } });
    return ok({});
  } catch {
    return fail("NOT_FOUND", "Cliente não encontrado", 404);
  }
}
