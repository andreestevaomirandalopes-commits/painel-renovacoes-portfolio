import { countCompletedAgendaEvents } from "@/lib/agenda";
import { agendaFailure } from "@/lib/agenda-api";
import { fail, ok } from "@/lib/api";
import { requireActiveUser } from "@/lib/permissions";
import { agendaMonthSchema } from "@/lib/validations/agenda";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!await requireActiveUser()) return fail("UNAUTHORIZED", "Faça login para acessar o resumo da Agenda.", 401);
    const month = agendaMonthSchema.parse(new URL(request.url).searchParams.get("month"));
    const response = ok({ month, count: await countCompletedAgendaEvents(month) });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return agendaFailure(error);
  }
}
