import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  if (request.nextUrl.pathname.startsWith("/financeiro") && request.auth?.user?.role === "OPERADOR") return NextResponse.redirect(new URL("/", request.url));
  if (request.auth) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
});

export const config={matcher:["/((?!login|setup|solicitar-acesso|api/auth|api/access-requests|api/reminders/run|_next|favicon.ico|uploads).*)"]};
