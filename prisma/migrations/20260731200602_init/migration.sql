-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('E_CNPJ', 'E_CPF', 'E_PF', 'E_PJ');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('A1', 'A3');

-- CreateEnum
CREATE TYPE "A3Model" AS ENUM ('TOKEN', 'NUVEM', 'CARTAO');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ATIVO', 'PROXIMO_VENCIMENTO', 'VENCIDO', 'RENOVADO');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "cpf" TEXT NOT NULL,
    "cnpj" TEXT,
    "certificateType" "CertificateType" NOT NULL,
    "a3Model" "A3Model",
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
    "providerResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "emailApiUrl" TEXT,
    "emailApiKey" TEXT,
    "emailSender" TEXT,
    "emailSenderName" TEXT,
    "whatsappApiUrl" TEXT,
    "whatsappApiToken" TEXT,
    "whatsappSender" TEXT,
    "emailSubject" TEXT,
    "emailTemplate" TEXT,
    "whatsappTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_orderNumber_key" ON "Client"("orderNumber");

-- CreateIndex
CREATE INDEX "Client_cpf_idx" ON "Client"("cpf");

-- CreateIndex
CREATE INDEX "Client_cnpj_idx" ON "Client"("cnpj");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "Client_expirationDate_idx" ON "Client"("expirationDate");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_productType_idx" ON "Client"("productType");

-- CreateIndex
CREATE INDEX "Client_certificateType_idx" ON "Client"("certificateType");

-- CreateIndex
CREATE INDEX "Client_cpf_expirationDate_idx" ON "Client"("cpf", "expirationDate");

-- CreateIndex
CREATE INDEX "ContactLog_clientId_idx" ON "ContactLog"("clientId");

-- CreateIndex
CREATE INDEX "ContactLog_createdAt_idx" ON "ContactLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
