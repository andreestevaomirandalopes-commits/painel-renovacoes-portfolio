import { auth } from "@/auth";

export async function POST(request:Request){
  if(!(await auth())?.user?.email)return Response.json({error:{message:"Não autenticado."}},{status:401});
  const file=(await request.formData()).get("file");
  if(!(file instanceof File)||!["image/png","image/jpeg"].includes(file.type)||file.size>2*1024*1024)return Response.json({error:{message:"Envie PNG ou JPEG de até 2 MB."}},{status:400});
  const encoded=Buffer.from(await file.arrayBuffer()).toString("base64");
  return Response.json({success:true,data:{imageUrl:`data:${file.type};base64,${encoded}`}});
}
