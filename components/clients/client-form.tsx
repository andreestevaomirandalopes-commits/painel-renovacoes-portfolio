"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateExpirationDate, type CertificateTypeInput } from "@/lib/certificates";

type Partner = { id: string; officeName: string; revCode: string };
type EditableClient = {
  id: string;
  name: string | null;
  orderNumber: string;
  productType: "E_CPF" | "E_CNPJ" | "E_PF" | "E_PJ";
  cpf: string;
  cnpj: string | null;
  certificateType: CertificateTypeInput;
  a3Model: "TOKEN" | "NUVEM" | "CARTAO" | null;
  issuedAt?: Date | string | null;
  purchaseDate: Date | string | null;
  email: string;
  phone: string | null;
  partnerId: string | null;
  estimatedValue?: number | null;
};

const asDateInput = (value: Date | string | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : "";

export function ClientForm({ partners = [], client }: { partners?: Partner[]; client?: EditableClient }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [productType, setProductType] = useState(client?.productType || "E_CPF");
  const [certificateType, setCertificateType] = useState<CertificateTypeInput>(client?.certificateType || "A1");
  const [a3Model, setA3Model] = useState(client?.a3Model || "");
  const [purchaseDate, setPurchaseDate] = useState(asDateInput(client?.purchaseDate));
  const [issuedAt, setIssuedAt] = useState(asDateInput(client?.issuedAt));
  const [price, setPrice] = useState(client?.estimatedValue?.toFixed(2) || "");
  const dateBase = issuedAt || purchaseDate;
  const expirationDate = calculateExpirationDate(dateBase, certificateType);

  useEffect(() => {
    if (certificateType === "A3" && !a3Model) return;
    fetch(`/api/pricing?productType=${productType}&certificateType=${certificateType}${a3Model ? `&a3Model=${a3Model}` : ""}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data.amount !== null) setPrice(Number(result.data.amount).toFixed(2));
      })
      .catch(() => undefined);
  }, [productType, certificateType, a3Model]);

  async function save(formData: FormData) {
    setError("");
    const body = Object.fromEntries(formData);
    if (!body.partnerId) delete body.partnerId;
    const response = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
      method: client ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!json.success) {
      setError(json.error?.message || "Não foi possível salvar o cliente.");
      return;
    }
    router.push("/clientes");
    router.refresh();
  }

  return <form action={save} className="bg-white border rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
    <Field name="name" label="Nome do cliente" defaultValue={client?.name || ""} />
    <Field name="orderNumber" label="Número do pedido" defaultValue={client?.orderNumber} />
    <label className="text-sm font-medium">Tipo do produto
      <select name="productType" value={productType} onChange={(event) => setProductType(event.target.value as typeof productType)}>
        {["E_CPF", "E_CNPJ", "E_PF", "E_PJ"].map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
    <label className="text-sm font-medium">Contador / escritório parceiro
      <select name="partnerId" defaultValue={client?.partnerId || ""}>
        <option value="">Não vincular parceiro</option>
        {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.officeName} — REV {partner.revCode}</option>)}
      </select>
    </label>
    <Field name="cpf" label="CPF" defaultValue={client?.cpf} />
    <Field name="cnpj" label="CNPJ" required={false} defaultValue={client?.cnpj || ""} />
    <label className="text-sm font-medium">Tipo do certificado
      <select name="certificateType" value={certificateType} onChange={(event) => setCertificateType(event.target.value as CertificateTypeInput)}>
        <option value="A1">A1</option><option value="A3">A3</option>
      </select>
    </label>
    {certificateType === "A3" && <label className="text-sm font-medium">Modelo A3
      <select name="a3Model" required value={a3Model} onChange={(event) => setA3Model(event.target.value as "TOKEN" | "NUVEM" | "CARTAO" | "")}>
        <option value="">Selecione</option><option value="TOKEN">TOKEN</option><option value="NUVEM">NUVEM</option><option value="CARTAO">CARTAO</option>
      </select>
    </label>}
    <label className="text-sm font-medium">Data da compra / validação
      <input name="purchaseDate" type="date" required value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
      <span className="block mt-1 text-xs font-normal text-slate-500">Usada para vendas, faturamento e comissão.</span>
    </label>
    <label className="text-sm font-medium">Data de emissão <span className="font-normal text-slate-500">(opcional)</span>
      <input name="issuedAt" type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} />
      <span className="block mt-1 text-xs font-normal text-slate-500">Quando informada, define o vencimento real do certificado.</span>
    </label>
    <label className="text-sm font-medium">Data de vencimento
      <input name="expirationDate" type="date" required readOnly value={expirationDate} className="bg-slate-100 text-slate-600" />
      <span className="block mt-1 text-xs font-normal text-slate-500">{issuedAt ? "Calculada pela data de emissão." : "Previsão calculada pela data da compra até a emissão ser confirmada."}</span>
    </label>
    <label className="text-sm font-medium">Valor do certificado (R$)
      <input name="estimatedValue" type="number" min="0" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} />
      <span className="block mt-1 text-xs text-slate-500">Preenchido pela tabela de preços; você pode ajustá-lo.</span>
    </label>
    <Field name="email" label="E-mail" type="email" defaultValue={client?.email} />
    <Field name="phone" label="Telefone" defaultValue={client?.phone || ""} />
    {error && <p className="text-red-600 text-sm md:col-span-2">{error}</p>}
    <button className="brand-bg text-white rounded-lg px-4 py-2 w-fit">{client ? "Salvar alterações" : "Salvar cliente"}</button>
  </form>;
}

function Field({ name, label, type = "text", required = true, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <label className="text-sm font-medium">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} /></label>;
}
