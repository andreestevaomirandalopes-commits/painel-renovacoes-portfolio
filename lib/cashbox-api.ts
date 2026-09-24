import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { fail } from "@/lib/api";
import { CashboxError } from "@/lib/cashbox";

export function cashboxFailure(error: unknown) {
  if (error instanceof CashboxError) return fail("CASHBOX_ERROR", error.message, error.status);
  if (error instanceof ZodError) return fail("VALIDATION_ERROR", error.issues[0]?.message || "Confira os campos informados.");
  if (error instanceof SyntaxError) return fail("INVALID_JSON", "Os dados enviados são inválidos.");
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2028", "P2034"].includes(error.code)) {
    return fail("CASHBOX_BUSY", "A Caixinha está sendo atualizada. Aguarde um momento e tente novamente.", 409);
  }
  console.error("Falha na Caixinha:", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "erro interno");
  return fail("INTERNAL_ERROR", "Não foi possível atualizar a Caixinha. Tente novamente.", 500);
}
