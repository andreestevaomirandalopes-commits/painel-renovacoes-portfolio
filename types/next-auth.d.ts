import "next-auth";
declare module "next-auth" { interface User { role?: "SUPER_ADMIN" | "ADMIN" | "OPERADOR" } interface Session { user: { role?: "SUPER_ADMIN" | "ADMIN" | "OPERADOR" } & DefaultSession["user"] } }
declare module "next-auth/jwt" { interface JWT { role?: "SUPER_ADMIN" | "ADMIN" | "OPERADOR" } }
