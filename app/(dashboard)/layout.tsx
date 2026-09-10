import { Sidebar } from "@/components/layout/sidebar";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({children}:{children:React.ReactNode}) {
  const session=await auth();
  const [branding,user,newAlertCount]=await Promise.all([prisma.appSettings.findUnique({where:{id:"default"}}),session?.user?.email?prisma.user.findUnique({where:{email:session.user.email},select:{role:true,imageUrl:true}}):null,prisma.cnpjAlert.count({where:{status:"NOVO",doNotContact:false}})]);
  const primary=branding?.primaryColor||"#0f766e",secondary=branding?.secondaryColor||"#ffffff";
  return <div className="dashboard-shell min-h-screen" style={{"--brand-primary":primary} as React.CSSProperties}>
    <Sidebar brandName={branding?.brandName||undefined} sidebarColor={branding?.sidebarColor||undefined} logoUrl={branding?.logoUrl} role={user?.role} newAlertCount={newAlertCount}/>
    <div className="dashboard-content min-w-0 transition-[margin] duration-300 ml-72"><header className="h-[76px] backdrop-blur border-b border-slate-200 px-8 flex justify-end items-center gap-4 sticky top-0 z-10" style={{backgroundColor:secondary}}><div className="flex items-center gap-3"><div className="hidden sm:block text-right"><p className="text-xs text-slate-500">Sessão ativa</p><p className="text-sm font-semibold text-slate-700">{session?.user?.email}</p></div>{user?.imageUrl?<img src={user.imageUrl} alt="Foto de perfil" className="h-10 w-10 rounded-full object-cover border"/>:<div className="h-10 w-10 rounded-full brand-bg text-white grid place-items-center font-bold">{session?.user?.email?.slice(0,1).toUpperCase()||"U"}</div>}<form action={async()=>{"use server";await signOut({redirectTo:"/login"})}}><button className="text-sm font-semibold brand-text px-2">Sair</button></form></div></header><main className="p-5 md:p-8 max-w-[1800px]">{children}</main></div>
  </div>;
}
