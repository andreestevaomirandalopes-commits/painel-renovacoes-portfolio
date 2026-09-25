import { deleteAgendaEvent, updateAgendaEvent } from "@/lib/agenda";
import { agendaFailure } from "@/lib/agenda-api";
import { fail, ok } from "@/lib/api";
import { requireActiveUser } from "@/lib/permissions";
import { updateAgendaEventSchema } from "@/lib/validations/agenda";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireActiveUser();
    if (!user) return fail("UNAUTHORIZED", "Faça login para editar um compromisso.", 401);
    return ok(await updateAgendaEvent((await params).id, updateAgendaEventSchema.parse(await request.json()), user.id));
  } catch (error) { return agendaFailure(error); }
}

export async function DELETE(_: Request, { params }: Context) {
  try {
    const user = await requireActiveUser();
    if (!user) return fail("UNAUTHORIZED", "Faça login para excluir um compromisso.", 401);
    await deleteAgendaEvent((await params).id, user.id);
    return ok({ deleted: true });
  } catch (error) { return agendaFailure(error); }
}
