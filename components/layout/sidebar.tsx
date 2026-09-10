"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BellRing, CalendarClock, ClipboardCheck, Handshake, History, LayoutDashboard, Menu, Settings, Upload, Users, Wallet } from "lucide-react";

const items=[ ["/","Dashboard",LayoutDashboard], ["/clientes","Clientes",Users], ["/parceiros","Parceiros",Handshake], ["/renovacoes","Renovações",CalendarClock], ["/alertas-cnpj","Alertas de CNPJ",BellRing], ["/conciliacao","Conciliação",ClipboardCheck], ["/importar","Importar planilha",Upload], ["/historico","Histórico",History], ["/financeiro","Financeiro",Wallet], ["/configuracoes","Configurações",Settings], ["/configuracoes/perfil","Meu perfil",Settings] ] as const;

export function Sidebar({brandName="Painel de Renovações",sidebarColor="#0f172a",logoUrl,role,newAlertCount=0}: {brandName?:string;sidebarColor?:string;logoUrl?:string|null;role?:"SUPER_ADMIN"|"ADMIN"|"OPERADOR";newAlertCount?:number}) {
  const pathname=usePathname(); const [compact,setCompact]=useState(false);
  return <aside className={`app-sidebar fixed inset-y-0 left-0 z-20 overflow-y-auto text-slate-200 shadow-2xl transition-all duration-300 ${compact?"sidebar-compact w-[5.5rem] p-3":"w-72 p-4"}`} style={{backgroundColor:sidebarColor}}>
    <div className={`flex items-center rounded-2xl bg-white/10 border border-white/10 p-3 mb-7 ${compact?"justify-center":"gap-3"}`}>
      {logoUrl?<img src={logoUrl} alt={`Logotipo ${brandName}`} className="h-11 w-11 shrink-0 object-contain"/>:<div className="h-11 w-11 shrink-0 rounded-xl bg-white/15 flex items-center justify-center font-bold">PR</div>}
      {!compact&&<div className="min-w-0"><p className="text-[10px] tracking-[.16em] uppercase text-slate-300">Gestão inteligente</p><h1 className="text-base font-bold text-white leading-tight truncate">{brandName}</h1></div>}
    </div>
    <div className={`flex items-center mb-3 ${compact?"justify-center":"justify-between px-3"}`}>
      {!compact&&<p className="text-[11px] font-semibold tracking-[.14em] uppercase text-slate-400">Menu</p>}
      <button type="button" title={compact?"Expandir menu":"Compactar menu"} aria-label={compact?"Expandir menu":"Compactar menu"} onClick={()=>setCompact(value=>!value)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><Menu size={18}/></button>
    </div>
    <nav className="space-y-1.5">{items.filter(([href])=>role!=="OPERADOR"||href!=="/financeiro").map(([href,label,Icon])=>{const active=href==="/"?pathname==="/":pathname===href||pathname.startsWith(`${href}/`);return <Link title={compact?label:undefined} className={`flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${compact?"justify-center p-3":"gap-3 p-3"} ${active?"bg-white text-slate-900 shadow-lg shadow-black/10":"text-slate-300 hover:bg-white/10 hover:text-white"}`} href={href as never} key={href}><Icon size={18} strokeWidth={active?2.4:2}/>{!compact&&<><span className="flex-1">{label}</span>{href==="/alertas-cnpj"&&newAlertCount>0&&<span className={`rounded-full px-2 py-0.5 text-[11px] ${active?"bg-slate-900 text-white":"bg-white/15 text-white"}`}>{newAlertCount > 99 ? "99+" : newAlertCount}</span>}</>}</Link>})}</nav>
    {!compact&&<div className="mt-10 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-slate-300">Acompanhe renovações, contatos e vendas em um só lugar.</div>}
  </aside>;
}
