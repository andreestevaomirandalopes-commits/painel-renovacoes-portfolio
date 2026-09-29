-- Acelera a consulta dos pedidos mais recentemente inseridos no painel.
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");
