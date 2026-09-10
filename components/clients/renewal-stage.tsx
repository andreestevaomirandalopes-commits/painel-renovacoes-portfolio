"use client";

import { useState } from "react";

const labels = { PENDENTE: "Pendente", CONTATADO: "Contatado", NEGOCIACAO: "Em negociação", RENOVADO: "Renovado", RECUSADO: "Recusado" } as const;
type RenewalStage = keyof typeof labels;
type CertificateType = "A1" | "A3";
type A3Model = "TOKEN" | "CARTAO" | "NUVEM";

export function RenewalStageControl({ clientId, stage, productType="E_CPF" }: { clientId: string; stage: RenewalStage; productType?: "E_CPF" | "E_CNPJ" | "E_PF" | "E_PJ" }) {
  const [value, setValue] = useState(stage);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function update(next: RenewalStage) {
    let newOrderNumber: string | undefined;
    let newCertificateType: CertificateType | undefined;
    let newA3Model: A3Model | undefined;
    let estimatedValue: number | undefined;
    if (next === "RENOVADO" && value !== "RENOVADO") {
      const orderResult = window.prompt("Informe o novo número do pedido para gerar a nova compra:");
      if (orderResult === null) return;
      newOrderNumber = orderResult.trim();
      if (!newOrderNumber) { setMessage("Informe o novo número do pedido."); return; }

      const certificateResult = window.prompt("Informe o modelo do certificado renovado: A1 ou A3.");
      if (certificateResult === null) return;
      const certificateType = certificateResult.trim().toUpperCase();
      if (certificateType !== "A1" && certificateType !== "A3") { setMessage("Informe A1 ou A3 para o modelo do certificado."); return; }
      newCertificateType = certificateType;

      if (newCertificateType === "A3") {
        const a3Result = window.prompt("Informe o modelo A3: Token, Cartão ou Nuvem.");
        if (a3Result === null) return;
        const normalized = a3Result.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalized !== "TOKEN" && normalized !== "CARTAO" && normalized !== "NUVEM") { setMessage("Para A3, informe Token, Cartão ou Nuvem."); return; }
        newA3Model = normalized;
      }
      const query = new URLSearchParams({ productType, certificateType: newCertificateType });
      if (newA3Model) query.set("a3Model", newA3Model);
      const priceResponse = await fetch(`/api/pricing?${query}`);
      const priceJson = await priceResponse.json();
      const suggested = priceJson.success && priceJson.data.amount !== null ? Number(priceJson.data.amount).toFixed(2) : "";
      const valueResult = window.prompt("Valor da nova compra (R$). Você pode editar o valor sugerido:", suggested);
      if (valueResult === null) return;
      estimatedValue = Number(valueResult.replace(",", "."));
      if (!Number.isFinite(estimatedValue) || estimatedValue < 0) { setMessage("Informe um valor válido para a nova compra."); return; }
    }
    setSaving(true); setMessage("");
    const response = await fetch(`/api/clients/${clientId}/stage`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: next, newOrderNumber, newCertificateType, newA3Model, estimatedValue }) });
    const result = await response.json(); setSaving(false);
    if (!result.success) { setMessage(result.error?.message || "Não foi possível atualizar."); return; }
    setValue(next); setMessage(result.message || "Atualizado.");
  }

  return <div><select aria-label="Etapa comercial" value={value} disabled={saving} onChange={(event) => update(event.target.value as RenewalStage)} className="w-36 text-xs py-1"><option value="PENDENTE">Pendente</option><option value="CONTATADO">Contatado</option><option value="NEGOCIACAO">Em negociação</option><option value="RENOVADO">Renovado</option><option value="RECUSADO">Recusado</option></select>{message && <p className="text-xs mt-1 text-slate-600">{message}</p>}</div>;
}
