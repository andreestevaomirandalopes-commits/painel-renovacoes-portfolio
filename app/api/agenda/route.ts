import { createAgendaEvent, listAgendaEvents } from "@/lib/agenda";
import { agendaFailure } from "@/lib/agenda-api";
import { fail, ok } from "@/lib/api";
import { requireActiveUser } from "@/lib/permissions";
import { agendaRangeSchema, createAgendaEventSchema } from "@/lib/validations/agenda";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!await requireActiveUser()) return fail("UNAUTHORIZED", "Faça login para acessar a Agenda.", 401);
    const url = new URL(request.url);
    const range = agendaRangeSchema.parse({ start: url.searchParams.get("start"), end: url.searchParams.get("end") });
    const response = ok(await listAgendaEvents(range.start, range.end));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return agendaFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    if (!user) return fail("UNAUTHORIZED", "Faça login para criar um compromisso.", 401);
    const input = createAgendaEventSchema.parse(await request.json());
    return ok(await createAgendaEvent(input, user.id), 201);
  } catch (error) { return agendaFailure(error); }
}
