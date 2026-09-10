# Painel de Gestão de Renovações

Projeto demonstrativo de um painel para gestão de certificados digitais, renovações, parceiros, conciliação financeira e alertas de novos CNPJs.

> Esta versão existe exclusivamente para portfólio. Não contém banco de dados, credenciais, arquivos enviados, logotipos de clientes, contatos reais ou rotinas de envio ativas.

## Recursos demonstrados

- Cadastro e acompanhamento de clientes e certificados A1/A3;
- Cálculo de vencimento a partir da data de emissão;
- Busca, filtros de 30/60/90 dias e vencimentos do dia;
- Importação de planilhas de clientes, parceiros, conciliação e datas de emissão;
- Parceiros, códigos REV e cálculo de comissões;
- Dashboard e visão financeira;
- Alertas de CNPJ com importação manual;
- Controle de acessos para Proprietário, Administrador e Operador;
- Perfil e personalização visual.

## Tecnologias

Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM, Auth.js/NextAuth, Zod, React Hook Form, SheetJS/XLSX e Vitest.

## Executar localmente

1. Instale Node.js LTS e pnpm.
2. Copie `.env.example` para `.env`.
3. Crie um banco PostgreSQL vazio e ajuste `DATABASE_URL`.
4. Execute:

```bash
pnpm install
pnpm exec prisma migrate deploy
pnpm demo:seed
pnpm dev
```

5. Abra `http://localhost:3000` e entre com:

```text
E-mail: demo@painelgestao.dev
Senha: Demo2026!
```

Os dados criados pelo comando de seed são inteiramente fictícios e podem ser apagados junto com o banco de demonstração.

## Segurança da demonstração

Com `DEMO_MODE=true`, o sistema bloqueia e-mails, WhatsApp e a rotina automática de lembretes, mesmo se uma chave for incluída por engano. Para uma instalação real, cada empresa deve usar banco, domínio, variáveis de ambiente e chaves de API próprios.

## Aviso de uso

Este repositório demonstra competências técnicas e arquitetura de software. Não inclui dados, identidade visual ou integrações da operação original.
