"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";

type Partner = { id: string; officeName: string; revCode: string };

export function PartnerCommissionAction({ itemId, orderNumber, commission, partners, defaultPartnerId, mappingKnown, canApply, appliedAt, appliedByName }: {
  itemId: string;
  orderNumber: string;
  commission: number;
  partners: Partner[];
  defaultPartnerId?: string | null;
  mappingKnown: boolean;
  canApply: boolean;
  appliedAt?: Date | string | null;
  appliedByName?: string | null;
}) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState(defaultPartnerId || "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  if (appliedAt) return <div className="text-xs text-emerald-700"><span className="inline-flex items-center gap-1 font-semibold"><CheckCircle2 size={14} />Adicionada</span><span className="mt-1 block">{new Date(appliedAt).toLocaleDateString("pt-BR")}{appliedByName ? ` · ${appliedByName}` : ""}</span></div>;
  if (!canApply) return <span className="text-xs text-slate-400">—</span>;
  const selectedPartner = partners.find((partner) => partner.id === partnerId);
  async function apply() {
    setMessage("");
    if (!partnerId || !selectedPartner) return setMessage("Selecione o parceiro.");
    const action = mappingKnown ? "registrar" : "confirmar o vínculo do código de vendedor e registrar";
    if (!window.confirm(`Você vai ${action} a comissão de R$ ${commission.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} do pedido ${orderNumber} para ${selectedPartner.officeName}. O valor da venda e o pedido não serão alterados. Deseja continuar?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/reconciliations/partner-commissions/${itemId}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partnerId }) });
      const result = await response.json() as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !result.success) { setMessage(result.error?.message || "Não foi possível adicionar a comissão."); return; }
      setMessage("Comissão adicionada.");
      router.refresh();
    } catch { setMessage("Não foi possível conectar ao painel."); }
    finally { setSaving(false); }
  }
  return <div className="min-w-52 space-y-1"><select value={partnerId} disabled={saving || mappingKnown} onChange={(event) => setPartnerId(event.target.value)} className="w-full text-xs"><option value="">Selecione o parceiro</option>{partners.map((partner) => <option value={partner.id} key={partner.id}>{partner.officeName} · REV {partner.revCode}</option>)}</select><button type="button" onClick={apply} disabled={saving || !partnerId} className="brand-bg inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{saving && <LoaderCircle size={13} className="animate-spin" />}{mappingKnown ? "Adicionar comissão" : "Vincular e adicionar"}</button>{message && <span className="block text-xs text-slate-600">{message}</span>}{!mappingKnown && <span className="block text-[11px] text-slate-400">O vínculo deste código será lembrado para as próximas planilhas.</span>}</div>;
}
