import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { fail } from "@/lib/api";
import { AgendaError } from "@/lib/agenda";

export function agendaFailure(error: unknown) {
  if (error instanceof AgendaError) return fail("AGENDA_ERROR", error.message, error.status);
  if (error instanceof ZodError) return fail("VALIDATION_ERROR", error.issues[0]?.message || "Confira os dados do compromisso.");
  if (error instanceof SyntaxError) return fail("INVALID_JSON", "Os dados enviados são inválidos.");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("SCHEDULE_CONFLICT", "Este responsável já possui um compromisso agendado neste horário.", 409);
  console.error("Falha na Agenda:", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "erro interno");
  return fail("INTERNAL_ERROR", "Não foi possível atualizar a Agenda. Tente novamente.", 500);
}
