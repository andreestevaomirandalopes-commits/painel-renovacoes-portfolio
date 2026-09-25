import { z } from "zod";

const calendarDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return value >= "1900-01-01" && value <= "9999-12-31" && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");

const agendaTime = z.string().trim().regex(/^\d{2}:\d{2}$/, "Informe um horário válido.").refine(value => {
  const [hour, minute] = value.split(":").map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 8 && hour <= 18 && minute >= 0 && minute < 60 && (hour < 18 || minute === 0);
}, "Escolha um horário entre 08:00 e 18:00.");

const agendaEvent = z.object({
  date: calendarDate,
  time: agendaTime,
  title: z.string().trim().min(1, "Informe o título do compromisso.").max(160, "O título deve ter até 160 caracteres."),
  notes: z.string().trim().max(1000, "As observações devem ter até 1.000 caracteres.").optional().transform(value => value || null),
  responsibleId: z.string().trim().min(1, "Escolha o responsável pelo compromisso.").max(100, "Responsável inválido."),
  reminderEnabled: z.boolean().optional().default(false),
});

export const createAgendaEventSchema = agendaEvent;
export const updateAgendaEventSchema = agendaEvent.extend({ status: z.enum(["AGENDADO", "CONCLUIDO", "CANCELADO"]) });
export const agendaRangeSchema = z.object({ start: calendarDate, end: calendarDate }).refine(({ start, end }) => {
  if (start > end) return false;
  return (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000 <= 93;
}, "Selecione um período de até 94 dias.");

export type CreateAgendaEventInput = z.infer<typeof createAgendaEventSchema>;
export type UpdateAgendaEventInput = z.infer<typeof updateAgendaEventSchema>;
