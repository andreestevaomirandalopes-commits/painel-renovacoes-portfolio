import { ok, fail } from "@/lib/api";
import { requireAdmin } from "@/lib/permissions";
import { createCashboxExpense } from "@/lib/cashbox";
import { cashboxFailure } from "@/lib/cashbox-api";
import { createExpenseSchema } from "@/lib/validations/cashbox";

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    if (!user) return fail("FORBIDDEN", "Acesso restrito a administradores e ao proprietário.", 403);
    const data = createExpenseSchema.parse(await request.json());
    return ok(await createCashboxExpense(data, user.id), 201);
  } catch (error) { return cashboxFailure(error); }
}
