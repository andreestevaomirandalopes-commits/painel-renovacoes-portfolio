import { ok, fail } from "@/lib/api";
import { requireAdmin } from "@/lib/permissions";
import { getCashboxSnapshot, setCashboxBalance } from "@/lib/cashbox";
import { cashboxFailure } from "@/lib/cashbox-api";
import { balanceSchema } from "@/lib/validations/cashbox";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!await requireAdmin()) return fail("FORBIDDEN", "Acesso restrito a administradores e ao proprietário.", 403);
    const response = ok(await getCashboxSnapshot());
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return cashboxFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await requireAdmin();
    if (!user) return fail("FORBIDDEN", "Acesso restrito a administradores e ao proprietário.", 403);
    const data = balanceSchema.parse(await request.json());
    return ok(await setCashboxBalance(data, user.id));
  } catch (error) { return cashboxFailure(error); }
}
