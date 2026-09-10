import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/settings/profile-form";
export default async function Profile(){const session=await auth();if(!session?.user?.email)redirect("/login");const user=await prisma.user.findUnique({where:{email:session.user.email},select:{name:true,imageUrl:true}});if(!user)redirect("/login");return <><Link href="/configuracoes" className="text-sm brand-text">← Configurações</Link><h2 className="text-2xl font-bold mt-4 mb-5">Meu perfil</h2><ProfileForm name={user.name} imageUrl={user.imageUrl}/></>}
