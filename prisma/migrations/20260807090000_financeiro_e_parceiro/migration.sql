ALTER TABLE "Client" ADD COLUMN "partnerId" TEXT;
CREATE INDEX "Client_partnerId_idx" ON "Client"("partnerId");
ALTER TABLE "Client" ADD CONSTRAINT "Client_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "Client" SET "estimatedValue" = CASE
  WHEN "productType" = 'E_CPF' AND "certificateType" = 'A1' THEN 158.87
  WHEN "productType" = 'E_CPF' AND "certificateType" = 'A3' AND "a3Model" = 'TOKEN' THEN 350.91
  WHEN "productType" = 'E_CPF' AND "certificateType" = 'A3' AND "a3Model" = 'CARTAO' THEN 233.57
  WHEN "productType" = 'E_CPF' AND "certificateType" = 'A3' AND "a3Model" = 'NUVEM' THEN 275.74
  WHEN "productType" = 'E_PF' AND "certificateType" = 'A1' THEN 185.90
  WHEN "productType" = 'E_PJ' AND "certificateType" = 'A1' THEN 274.90
  WHEN "productType" = 'E_CNPJ' AND "certificateType" = 'A1' THEN 189.68
  WHEN "productType" = 'E_CNPJ' AND "certificateType" = 'A3' AND "a3Model" = 'TOKEN' THEN 434.69
  WHEN "productType" = 'E_CNPJ' AND "certificateType" = 'A3' AND "a3Model" = 'CARTAO' THEN 322.49
  WHEN "productType" = 'E_CNPJ' AND "certificateType" = 'A3' AND "a3Model" = 'NUVEM' THEN 355.22
  ELSE NULL END
WHERE "estimatedValue" IS NULL;
