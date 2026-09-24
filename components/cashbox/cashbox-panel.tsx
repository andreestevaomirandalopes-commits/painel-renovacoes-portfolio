"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ReceiptText, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { TableScroll } from "@/components/layout/table-scroll";
import type { CashboxSnapshot } from "@/lib/cashbox-types";

type Expense = CashboxSnapshot["expenses"][number];
type Draft = { amount: string; description: string; establishment: string; purchaseDate: string };
type Message = { text: string; error: boolean };
type ApiResult = { success: boolean; data?: CashboxSnapshot; error?: { message?: string } };

const money = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const inputAmount = (value: string) => value.replace(".", ",");
const primaryButton = "brand-bg text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryButton = "border rounded-lg px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed";

function emptyDraft(): Draft {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return { amount: "", description: "", establishment: "", purchaseDate: `${part("year")}-${part("month")}-${part("day")}` };
}
function decimalAmount(value: string, allowZero: boolean) {
  const text = value.trim();
  if (!/^\d{1,10}(?:[,.]\d{1,2})?$/.test(text)) throw new Error("Informe um valor válido, sem sinal negativo, com até duas casas decimais. Exemplo: 35,90.");
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const normalized = `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(2, "0")}`;
  if (!allowZero && /^0\.00$/.test(normalized)) throw new Error("O valor da compra deve ser maior que zero.");
  return normalized;
}

export function CashboxPanel({ initialSnapshot }: { initialSnapshot: CashboxSnapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceInput, setBalanceInput] = useState(inputAmount(initialSnapshot.balance));
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState(false);
  const busyRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setSnapshot(initialSnapshot), [initialSnapshot]);

  async function refreshSnapshot() {
    const response = await fetch("/api/cashbox", { cache: "no-store" });
    const result: ApiResult = await response.json();
    if (response.ok && result.success && result.data) setSnapshot(result.data);
  }

  async function mutate(url: string, method: string, body: object, successMessage: string) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result: ApiResult = await response.json();
      if (!response.ok || !result.success || !result.data) {
        let text = result.error?.message || "Não foi possível salvar a movimentação.";
        if (response.status === 409) {
          try { await refreshSnapshot(); } catch { /* Preserve the original conflict message if refresh fails. */ }
          text += method === "PATCH" && url.startsWith("/api/cashbox/expenses/")
            ? " Selecione Editar novamente na linha do histórico para carregar a versão atual da compra."
            : " Confira o histórico e revise os dados antes de tentar novamente.";
        }
        setMessage({ text, error: true });
        return false;
      }
      setSnapshot(result.data);
      setMessage({ text: successMessage, error: false });
      router.refresh();
      return true;
    } catch {
      setMessage({ text: "Não foi possível confirmar a operação. Verifique sua conexão e confira o histórico antes de repetir." + (method === "POST" ? " Ao tentar salvar a mesma compra novamente, ela não será duplicada." : ""), error: true });
      return false;
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    let amount: string;
    try { amount = decimalAmount(draft.amount, false); }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); return; }
    const fields = { ...draft, amount, description: draft.description.trim(), establishment: draft.establishment.trim() };
    if (!fields.description || !fields.establishment) {
      setMessage({ text: "Preencha a descrição e o estabelecimento da compra.", error: true });
      return;
    }
    if (!editing && !requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    const saved = await mutate(
      editing ? `/api/cashbox/expenses/${editing.id}` : "/api/cashbox/expenses",
      editing ? "PATCH" : "POST",
      editing ? { ...fields, version: editing.version } : { ...fields, requestId: requestIdRef.current },
      editing ? "Compra atualizada. O saldo da caixinha foi recalculado." : "Compra registrada e descontada do saldo da caixinha.",
    );
    if (saved) {
      setDraft(emptyDraft());
      setEditing(null);
      requestIdRef.current = null;
    }
  }

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    let balance: string;
    try { balance = decimalAmount(balanceInput, true); }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); return; }
    if (!window.confirm(`Definir o saldo atual da caixinha como ${money(balance)}? O histórico de compras será mantido. Confirme o dinheiro físico disponível antes de continuar.`)) return;
    if (await mutate("/api/cashbox", "PATCH", { balance, version: snapshot.version }, "Saldo atual da caixinha ajustado com sucesso.")) setBalanceOpen(false);
  }

  function editExpense(expense: Expense) {
    setEditing(expense);
    setDraft({ amount: inputAmount(expense.amount), description: expense.description, establishment: expense.establishment, purchaseDate: expense.purchaseDate });
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    formRef.current?.querySelector<HTMLInputElement>("input[name='amount']")?.focus({ preventScroll: true });
  }

  function clearDraft() {
    if (!editing && requestIdRef.current && !window.confirm("Confira no histórico se a última compra já foi registrada antes de começar outra. Deseja limpar o formulário?")) return;
    setEditing(null);
    setDraft(emptyDraft());
    requestIdRef.current = null;
    setMessage(null);
  }

  async function deleteExpense(expense: Expense) {
    if (busyRef.current || !window.confirm(`Excluir a compra “${expense.description}”, de ${money(expense.amount)}? O valor será devolvido ao saldo da caixinha. Esta exclusão não pode ser desfeita.`)) return;
    if (await mutate(`/api/cashbox/expenses/${expense.id}`, "DELETE", { version: expense.version }, "Compra excluída. O valor foi devolvido ao saldo da caixinha.") && editing?.id === expense.id) {
      setEditing(null);
      setDraft(emptyDraft());
    }
  }

  return <div className="space-y-6" aria-busy={pending}>
    <section className="grid gap-4 lg:grid-cols-3" aria-label="Resumo da caixinha">
      <div className="bg-white border rounded-xl p-5">
        <div className="flex justify-between gap-3 items-center"><h3 className="text-sm text-slate-500">Saldo atual da Caixinha</h3><Wallet size={20} className="brand-text" aria-hidden="true" /></div>
        <p className={`mt-2 text-2xl font-bold ${Number(snapshot.balance) < 0 ? "text-red-700" : "brand-text"}`}>{money(snapshot.balance)}</p>
        <button type="button" className="mt-3 text-sm font-semibold brand-text underline underline-offset-2 disabled:opacity-50" disabled={pending} aria-expanded={balanceOpen} aria-controls="cashbox-balance-form" onClick={() => { setBalanceInput(inputAmount(snapshot.balance)); setBalanceOpen(!balanceOpen); }}>Definir ou ajustar saldo</button>
      </div>
      <div className="bg-white border rounded-xl p-5">
        <div className="flex justify-between gap-3 items-center"><h3 className="text-sm text-slate-500">Total gasto no mês</h3><ReceiptText size={20} className="brand-text" aria-hidden="true" /></div>
        <p className="mt-2 text-2xl font-bold">{money(snapshot.totalSpentThisMonth)}</p>
        <p className="mt-2 text-xs text-slate-500">Pela data da compra, no mês atual.</p>
      </div>
      <div className="bg-white border rounded-xl p-5">
        <div className="flex justify-between gap-3 items-center"><h3 className="text-sm text-slate-500">Quantidade de compras</h3><ShoppingBag size={20} className="brand-text" aria-hidden="true" /></div>
        <p className="mt-2 text-2xl font-bold">{snapshot.purchaseCount.toLocaleString("pt-BR")}</p>
        <p className="mt-2 text-xs text-slate-500">Total de registros no histórico.</p>
      </div>
    </section>

    {message && <p role={message.error ? "alert" : "status"} className={`border rounded-xl px-4 py-3 text-sm ${message.error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>{message.text}</p>}

    {balanceOpen && <form id="cashbox-balance-form" onSubmit={saveBalance} className="bg-white border rounded-xl p-5">
      <h3 className="font-bold">Definir ou ajustar saldo</h3>
      <p className="text-sm text-slate-500 mt-1 mb-4">Informe o total em dinheiro físico disponível agora. Na primeira utilização, este será o saldo inicial. Um ajuste posterior mantém o histórico e define o novo saldo disponível.</p>
      <fieldset disabled={pending} className="flex flex-wrap gap-4 items-end">
        <label className="text-sm font-medium w-full sm:max-w-xs">Saldo disponível (R$)<input name="balance" inputMode="decimal" placeholder="500,00" value={balanceInput} onChange={(event) => setBalanceInput(event.target.value)} maxLength={13} required /></label>
        <button className={primaryButton} type="submit">{pending ? "Salvando..." : "Salvar saldo"}</button>
        <button className={secondaryButton} type="button" onClick={() => setBalanceOpen(false)}>Cancelar</button>
      </fieldset>
    </form>}

    <form ref={formRef} onSubmit={saveExpense} className="bg-white border rounded-xl p-5">
      <h3 className="font-bold">{editing ? "Editar compra" : "Registrar nova compra"}</h3>
      <p className="text-sm text-slate-500 mt-1 mb-4">Registre despesas pagas com dinheiro da caixinha. Para uma retirada, descreva a finalidade e informe o destinatário no campo Estabelecimento.</p>
      <fieldset disabled={pending} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <label className="text-sm font-medium">Valor da compra (R$)<input name="amount" inputMode="decimal" placeholder="35,90" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} maxLength={13} required /></label>
        <label className="text-sm font-medium">Data da compra<input name="purchaseDate" type="date" min="1900-01-01" max="9999-12-31" value={draft.purchaseDate} onChange={(event) => setDraft({ ...draft, purchaseDate: event.target.value })} required /></label>
        <label className="text-sm font-medium">Produto / descrição<input name="description" placeholder="Material de escritório" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={200} required /></label>
        <label className="text-sm font-medium">Estabelecimento<input name="establishment" placeholder="Papelaria Central" value={draft.establishment} onChange={(event) => setDraft({ ...draft, establishment: event.target.value })} maxLength={200} required /></label>
        <div className="flex flex-wrap gap-3 lg:col-span-2">
          <button className={primaryButton} type="submit">{pending ? "Salvando..." : editing ? "Salvar alterações" : "Registrar compra"}</button>
          <button type="button" className={secondaryButton} onClick={clearDraft}>{editing ? "Cancelar edição" : "Limpar formulário"}</button>
        </div>
      </fieldset>
    </form>

    <section className="bg-white border rounded-xl overflow-hidden" aria-labelledby="cashbox-history-title">
      <div className="p-5"><h3 id="cashbox-history-title" className="font-bold">Histórico de movimentações</h3><p className="text-sm text-slate-500 mt-1">Compras e retiradas, da data mais recente para a mais antiga.</p></div>
      <TableScroll><table className="min-w-[760px]">
        <thead><tr><th scope="col">Data</th><th scope="col">Produto / descrição</th><th scope="col">Estabelecimento</th><th scope="col">Valor</th><th scope="col">Ações</th></tr></thead>
        <tbody>{snapshot.expenses.map((expense) => <tr key={expense.id}>
          <td><time dateTime={expense.purchaseDate}>{dateLabel(expense.purchaseDate)}</time></td>
          <td className="max-w-md whitespace-normal break-words">{expense.description}</td>
          <td className="max-w-xs whitespace-normal break-words">{expense.establishment}</td>
          <td className="font-semibold">{money(expense.amount)}</td>
          <td><div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => editExpense(expense)} className="border rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50" aria-label={`Editar compra: ${expense.description}`}><Pencil size={15} aria-hidden="true" />Editar</button>
            <button type="button" disabled={pending} onClick={() => deleteExpense(expense)} className="border rounded-lg px-3 py-2 text-sm text-red-600 inline-flex items-center gap-2 disabled:opacity-50" aria-label={`Excluir compra: ${expense.description}`}><Trash2 size={15} aria-hidden="true" />Excluir</button>
          </div></td>
        </tr>)}{snapshot.expenses.length === 0 && <tr><td colSpan={5} className="text-slate-500 whitespace-normal">Nenhuma movimentação registrada. Defina o saldo da caixinha e cadastre a primeira compra.</td></tr>}</tbody>
      </table></TableScroll>
    </section>
  </div>;
}
