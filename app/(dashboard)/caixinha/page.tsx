import { redirect } from "next/navigation";
import { CashboxPanel } from "@/components/cashbox/cashbox-panel";
import { getCashboxSnapshot } from "@/lib/cashbox";
import { requireAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CashboxPage() {
  if (!(await requireAdmin())) redirect("/");
  const snapshot = await getCashboxSnapshot();

  return <>
    <div className="mb-6">
      <h2 className="text-2xl font-bold">Caixinha</h2>
      <p className="text-slate-500 mt-1">Controle o dinheiro em espécie disponível e acompanhe as compras e retiradas da empresa.</p>
    </div>
    <CashboxPanel initialSnapshot={snapshot} />
  </>;
}
