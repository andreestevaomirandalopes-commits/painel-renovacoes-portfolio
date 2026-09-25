import { AgendaStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreateAgendaEventInput, UpdateAgendaEventInput } from "@/lib/validations/agenda";

export type AgendaEventDto = {
  id: string; date: string; time: string; title: string; notes: string | null;
  responsible: { id: string; name: string; email: string };
  reminderEnabled: boolean; status: AgendaStatus; createdAt: string; updatedAt: string;
};

export class AgendaError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name = "AgendaError"; }
}

const eventInclude = { responsible: { select: { id: true, name: true, email: true } } } satisfies Prisma.AgendaEventInclude;
type EventWithResponsible = Prisma.AgendaEventGetPayload<{ include: typeof eventInclude }>;
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

function serialize(event: EventWithResponsible): AgendaEventDto {
  return { id: event.id, date: event.date.toISOString().slice(0, 10), time: event.time, title: event.title, notes: event.notes, responsible: event.responsible, reminderEnabled: event.reminderEnabled, status: event.status, createdAt: event.createdAt.toISOString(), updatedAt: event.updatedAt.toISOString() };
}

async function ensureResponsibleIsActive(tx: Prisma.TransactionClient, responsibleId: string) {
  if (!await tx.user.findFirst({ where: { id: responsibleId, active: true }, select: { id: true } })) throw new AgendaError("O responsável selecionado não está ativo. Atualize a agenda e escolha outra pessoa.", 409);
}

async function ensureAvailableSlot(tx: Prisma.TransactionClient, input: { responsibleId: string; date: string; time: string }, excludingId?: string) {
  const conflict = await tx.agendaEvent.findFirst({ where: { responsibleId: input.responsibleId, date: asDate(input.date), time: input.time, status: "AGENDADO", ...(excludingId ? { id: { not: excludingId } } : {}) }, select: { id: true } });
  if (conflict) throw new AgendaError("Este responsável já possui um compromisso agendado nesta data e horário. Escolha outro horário ou responsável.", 409);
}

async function recordAgendaAudit(tx: Prisma.TransactionClient, actorUserId: string, action: string, event: { id: string; date: Date; time: string; title: string; responsibleId: string; status: AgendaStatus; reminderEnabled: boolean }) {
  await tx.auditLog.create({ data: { actorUserId, action, entity: "AgendaEvent", entityId: event.id, details: { date: event.date.toISOString().slice(0, 10), time: event.time, title: event.title, responsibleId: event.responsibleId, status: event.status, reminderEnabled: event.reminderEnabled } } });
}

export async function listAgendaEvents(start: string, end: string) {
  const events = await prisma.agendaEvent.findMany({ where: { date: { gte: asDate(start), lte: asDate(end) } }, include: eventInclude, orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "asc" }] });
  return events.map(serialize);
}

export async function createAgendaEvent(input: CreateAgendaEventInput, actorUserId: string) {
  try { return await prisma.$transaction(async tx => { await ensureResponsibleIsActive(tx, input.responsibleId); await ensureAvailableSlot(tx, input); const event = await tx.agendaEvent.create({ data: { ...input, date: asDate(input.date), createdById: actorUserId, status: "AGENDADO" }, include: eventInclude }); await recordAgendaAudit(tx, actorUserId, "AGENDA_EVENT_CREATED", event); return serialize(event); }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AgendaError("Este responsável acabou de receber um compromisso neste horário. Atualize a agenda e escolha outro horário.", 409); throw error; }
}

export async function updateAgendaEvent(id: string, input: UpdateAgendaEventInput, actorUserId: string) {
  try { return await prisma.$transaction(async tx => { if (!await tx.agendaEvent.findUnique({ where: { id }, select: { id: true } })) throw new AgendaError("Compromisso não encontrado. Atualize a agenda.", 404); await ensureResponsibleIsActive(tx, input.responsibleId); if (input.status === "AGENDADO") await ensureAvailableSlot(tx, input, id); const event = await tx.agendaEvent.update({ where: { id }, data: { ...input, date: asDate(input.date) }, include: eventInclude }); await recordAgendaAudit(tx, actorUserId, "AGENDA_EVENT_UPDATED", event); return serialize(event); }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AgendaError("Este responsável já possui um compromisso agendado neste horário. Escolha outro horário ou responsável.", 409); throw error; }
}

export async function deleteAgendaEvent(id: string, actorUserId: string) {
  return prisma.$transaction(async tx => { const event = await tx.agendaEvent.findUnique({ where: { id }, select: { id: true, date: true, time: true, title: true, responsibleId: true, status: true, reminderEnabled: true } }); if (!event) throw new AgendaError("Compromisso não encontrado. Atualize a agenda.", 404); await tx.agendaEvent.delete({ where: { id } }); await recordAgendaAudit(tx, actorUserId, "AGENDA_EVENT_DELETED", event); });
}
