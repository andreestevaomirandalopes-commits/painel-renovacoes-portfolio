import "./globals.css";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
export const metadata: Metadata={title:"Painel de Renovações",description:"Gestão de certificados digitais"};
export default async function RootLayout({children}:{children:React.ReactNode}) { const branding=await prisma.appSettings.findUnique({where:{id:"default"}}); return <html lang="pt-BR"><body style={{"--brand-primary":branding?.primaryColor||"#0f766e"} as React.CSSProperties}>{children}</body></html> }
