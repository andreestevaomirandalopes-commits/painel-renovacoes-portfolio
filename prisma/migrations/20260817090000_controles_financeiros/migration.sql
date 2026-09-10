ALTER TABLE "Client" ADD COLUMN "priceRuleId" TEXT;
CREATE INDEX "Client_priceRuleId_idx" ON "Client"("priceRuleId");
CREATE TABLE "PriceRule" (
  "id" TEXT NOT NULL,
  "productType" "ProductType" NOT NULL,
  "certificateType" "CertificateType" NOT NULL,
  "a3Model" "A3Model",
  "amount" DECIMAL(12,2) NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PriceRule_productType_certificateType_a3Model_effectiveFrom_idx" ON "PriceRule"("productType","certificateType","a3Model","effectiveFrom");
ALTER TABLE "Client" ADD CONSTRAINT "Client_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "PriceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "FinancialClose" (
  "id" TEXT NOT NULL,
  "month" TIMESTAMP(3) NOT NULL,
  "saleCount" INTEGER NOT NULL,
  "totalRevenue" DECIMAL(14,2) NOT NULL,
  "totalCommission" DECIMAL(14,2) NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedById" TEXT NOT NULL,
  CONSTRAINT "FinancialClose_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialClose_month_key" ON "FinancialClose"("month");
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity","entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
INSERT INTO "PriceRule" ("id","productType","certificateType","a3Model","amount","effectiveFrom") VALUES
  ('price_ecpf_a1','E_CPF','A1',NULL,158.87,'2020-01-01'),
  ('price_ecpf_a3_token','E_CPF','A3','TOKEN',350.91,'2020-01-01'),
  ('price_ecpf_a3_cartao','E_CPF','A3','CARTAO',233.57,'2020-01-01'),
  ('price_ecpf_a3_nuvem','E_CPF','A3','NUVEM',275.74,'2020-01-01'),
  ('price_epf_a1','E_PF','A1',NULL,185.90,'2020-01-01'),
  ('price_epj_a1','E_PJ','A1',NULL,274.90,'2020-01-01'),
  ('price_ecnpj_a1','E_CNPJ','A1',NULL,189.68,'2020-01-01'),
  ('price_ecnpj_a3_token','E_CNPJ','A3','TOKEN',434.69,'2020-01-01'),
  ('price_ecnpj_a3_cartao','E_CNPJ','A3','CARTAO',322.49,'2020-01-01'),
  ('price_ecnpj_a3_nuvem','E_CNPJ','A3','NUVEM',355.22,'2020-01-01');
UPDATE "Client" SET "priceRuleId" = CASE
  WHEN "productType"='E_CPF' AND "certificateType"='A1' THEN 'price_ecpf_a1'
  WHEN "productType"='E_CPF' AND "certificateType"='A3' AND "a3Model"='TOKEN' THEN 'price_ecpf_a3_token'
  WHEN "productType"='E_CPF' AND "certificateType"='A3' AND "a3Model"='CARTAO' THEN 'price_ecpf_a3_cartao'
  WHEN "productType"='E_CPF' AND "certificateType"='A3' AND "a3Model"='NUVEM' THEN 'price_ecpf_a3_nuvem'
  WHEN "productType"='E_PF' AND "certificateType"='A1' THEN 'price_epf_a1'
  WHEN "productType"='E_PJ' AND "certificateType"='A1' THEN 'price_epj_a1'
  WHEN "productType"='E_CNPJ' AND "certificateType"='A1' THEN 'price_ecnpj_a1'
  WHEN "productType"='E_CNPJ' AND "certificateType"='A3' AND "a3Model"='TOKEN' THEN 'price_ecnpj_a3_token'
  WHEN "productType"='E_CNPJ' AND "certificateType"='A3' AND "a3Model"='CARTAO' THEN 'price_ecnpj_a3_cartao'
  WHEN "productType"='E_CNPJ' AND "certificateType"='A3' AND "a3Model"='NUVEM' THEN 'price_ecnpj_a3_nuvem'
  ELSE NULL END WHERE "priceRuleId" IS NULL;
