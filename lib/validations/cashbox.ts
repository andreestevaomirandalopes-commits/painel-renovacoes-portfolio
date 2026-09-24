import { z } from "zod";

const money = z.string().trim().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Informe um valor válido com até duas casas decimais.");
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da compra.").refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return value >= "1900-01-01" && value <= "9999-12-31" && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");

export const expenseSchema = z.object({
  amount: money.refine(value => /[1-9]/.test(value), "O valor da compra deve ser maior que zero."),
  description: z.string().trim().min(1, "Informe o produto ou a descrição.").max(200, "A descrição deve ter até 200 caracteres."),
  establishment: z.string().trim().min(1, "Informe o estabelecimento ou o destino da retirada.").max(200, "O estabelecimento deve ter até 200 caracteres."),
  purchaseDate: calendarDate,
});

export const createExpenseSchema = expenseSchema.extend({ requestId: z.string().uuid("Identificador da compra inválido. Atualize a página.") });
export const versionSchema = z.object({ version: z.number().int().min(0) });
export const updateExpenseSchema = expenseSchema.extend(versionSchema.shape);
export const balanceSchema = z.object({ balance: money, ...versionSchema.shape });
