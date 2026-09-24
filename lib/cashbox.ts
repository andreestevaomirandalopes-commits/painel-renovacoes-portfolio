import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { CashboxSnapshot } from "@/lib/cashbox-types";
import { balanceSchema, createExpenseSchema, updateExpenseSchema } from "@/lib/validations/cashbox";

const CASHBOX_ID = "default";
const zero = new Prisma.Decimal(0);

export class CashboxError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "CashboxError";
  }
}

async function snapshot(tx: Prisma.TransactionClient): Promise<CashboxSnapshot> {
  const box = await tx.cashbox.findUnique({
    where: { id: CASHBOX_ID },
    include: { expenses: { orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }] } },
  });
  if (!box) throw new CashboxError("A Caixinha ainda não está disponível. Execute as migrações da demonstração.", 503);

  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const month = `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}`;
  let spent = zero;
  let monthSpent = zero;
  const expenses = box.expenses.map(expense => {
    spent = spent.plus(expense.amount);
    const purchaseDate = expense.purchaseDate.toISOString().slice(0, 10);
    if (purchaseDate.startsWith(month)) monthSpent = monthSpent.plus(expense.amount);
    return { id: expense.id, amount: expense.amount.toFixed(2), description: expense.description, establishment: expense.establishment, purchaseDate, version: expense.version };
  });
  return { balance: box.openingBalance.minus(spent).toFixed(2), totalSpentThisMonth: monthSpent.toFixed(2), purchaseCount: expenses.length, version: box.version, expenses };
}

export function getCashboxSnapshot() {
  return prisma.$transaction(tx => snapshot(tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

async function changeCashbox(change: (tx: Prisma.TransactionClient, current: CashboxSnapshot) => Promise<boolean>) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Cashbox" WHERE "id" = ${CASHBOX_ID} FOR UPDATE`;
    const current = await snapshot(tx);
    if (await change(tx, current)) {
      await tx.cashbox.update({ where: { id: CASHBOX_ID }, data: { version: { increment: 1 } } });
    }
    return snapshot(tx);
  }, { maxWait: 10000, timeout: 15000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

async function recordChange(tx: Prisma.TransactionClient, actorId: string, action: string, entityId: string, details: Prisma.InputJsonObject) {
  await tx.auditLog.create({ data: { actorUserId: actorId, action, entity: "Cashbox", entityId, details } });
}

function ensureFunds(balance: string, debit: Prisma.Decimal) {
  if (new Prisma.Decimal(balance).minus(debit).isNegative()) {
    throw new CashboxError("Saldo insuficiente na Caixinha. Confira o valor ou ajuste o saldo disponível.", 409);
  }
}

export function setCashboxBalance(input: z.infer<typeof balanceSchema>, actorId: string) {
  const data = balanceSchema.parse(input);
  return changeCashbox(async (tx, current) => {
    if (data.version !== current.version) throw new CashboxError("A Caixinha foi alterada por outro usuário. Atualize os dados e confira o saldo antes de ajustar.", 409);
    const spent = current.expenses.reduce((sum, expense) => sum.plus(expense.amount), zero);
    const openingBalance = spent.plus(data.balance);
    if (openingBalance.greaterThan("999999999999.99")) throw new CashboxError("O valor ultrapassa o limite da Caixinha.");
    await tx.cashbox.update({ where: { id: CASHBOX_ID }, data: { openingBalance } });
    await recordChange(tx, actorId, "CASHBOX_BALANCE_ADJUSTED", CASHBOX_ID, { previousBalance: current.balance, balance: new Prisma.Decimal(data.balance).toFixed(2) });
    return true;
  });
}

export function createCashboxExpense(input: z.infer<typeof createExpenseSchema>, actorId: string) {
  const data = createExpenseSchema.parse(input);
  return changeCashbox(async (tx, current) => {
    const amount = new Prisma.Decimal(data.amount);
    const existing = await tx.cashboxExpense.findUnique({ where: { requestId: data.requestId } });
    if (existing) {
      if (!existing.amount.equals(amount) || existing.description !== data.description || existing.establishment !== data.establishment || existing.purchaseDate.toISOString().slice(0, 10) !== data.purchaseDate) {
        throw new CashboxError("Esta compra já foi salva com outros dados. Confira o histórico antes de registrar uma nova compra.", 409);
      }
      return false;
    }
    ensureFunds(current.balance, amount);
    const expense = await tx.cashboxExpense.create({ data: { ...data, amount, purchaseDate: new Date(`${data.purchaseDate}T00:00:00.000Z`), cashboxId: CASHBOX_ID } });
    await recordChange(tx, actorId, "CASHBOX_EXPENSE_CREATED", expense.id, { ...data });
    return true;
  });
}

export function updateCashboxExpense(id: string, input: z.infer<typeof updateExpenseSchema>, actorId: string) {
  const data = updateExpenseSchema.parse(input);
  return changeCashbox(async (tx, current) => {
    const previous = current.expenses.find(expense => expense.id === id);
    if (!previous) throw new CashboxError("A compra não foi encontrada. Atualize o histórico.", 404);
    if (previous.version !== data.version) throw new CashboxError("Esta compra foi alterada por outro usuário. Atualize os dados antes de editar.", 409);
    const amount = new Prisma.Decimal(data.amount);
    ensureFunds(current.balance, amount.minus(previous.amount));
    await tx.cashboxExpense.update({ where: { id }, data: { amount, description: data.description, establishment: data.establishment, purchaseDate: new Date(`${data.purchaseDate}T00:00:00.000Z`), version: { increment: 1 } } });
    await recordChange(tx, actorId, "CASHBOX_EXPENSE_UPDATED", id, { before: previous, after: { ...data } });
    return true;
  });
}

export function deleteCashboxExpense(id: string, version: number, actorId: string) {
  return changeCashbox(async (tx, current) => {
    const previous = current.expenses.find(expense => expense.id === id);
    if (!previous) throw new CashboxError("A compra não foi encontrada. Atualize o histórico.", 404);
    if (previous.version !== version) throw new CashboxError("Esta compra foi alterada por outro usuário. Atualize os dados antes de excluir.", 409);
    await tx.cashboxExpense.delete({ where: { id } });
    await recordChange(tx, actorId, "CASHBOX_EXPENSE_DELETED", id, { before: previous });
    return true;
  });
}
