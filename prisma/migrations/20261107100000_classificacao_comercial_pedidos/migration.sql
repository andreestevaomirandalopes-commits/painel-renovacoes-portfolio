-- Mantém o status do certificado separado da classificação comercial do pedido.
CREATE TYPE "OrderType" AS ENUM ('VENDA_NOVA', 'RENOVADO');

ALTER TABLE "Client"
ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'VENDA_NOVA';
