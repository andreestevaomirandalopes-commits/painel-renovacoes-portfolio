import { ok, fail } from "@/lib/api";
import { requireAdmin } from "@/lib/permissions";
import { updateCashboxExpense, deleteCashboxExpense } from "@/lib/cashbox";
import { cashboxFailure } from "@/lib/cashbox-api";
import { updateExpenseSchema, versionSchema } from "@/lib/validations/cashbox";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireAdmin();
    if (!user) return fail("FORBIDDEN", "Acesso restrito a administradores e ao proprietário.", 403);
    const data = updateExpenseSchema.parse(await request.json());
    return ok(await updateCashboxExpense((await params).id, data, user.id));
  } catch (error) { return cashboxFailure(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    const user = await requireAdmin();
    if (!user) return fail("FORBIDDEN", "Acesso restrito a administradores e ao proprietário.", 403);
    const data = versionSchema.parse(await request.json());
    return ok(await deleteCashboxExpense((await params).id, data.version, user.id));
  } catch (error) { return cashboxFailure(error); }
}
