CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');
CREATE TABLE "AccessRequest" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "requestedRole" "UserRole" NOT NULL DEFAULT 'ADMIN',
  "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDENTE',
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccessRequest_email_key" ON "AccessRequest"("email");
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");
