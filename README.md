# AssinaSol

Aplicacao Next.js para carregar conta de energia em PDF, extrair dados, revisar campos, salvar cliente, calcular cobranca solar e gerar uma proposta de energia por assinatura em PDF.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- React Hook Form
- Zod
- PDF.js para leitura
- pdf-lib para geracao de PDF

## Setup

```bash
npm install
npm run dev
```

Acesse `http://127.0.0.1:3000/entrar`.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SOLAR_DEMO_USER_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_PREMIUM=
COMPLIMENTARY_USER_ID=
```

Sem Supabase configurado, o app continua funcionando para preview: a autenticacao fica liberada localmente, clientes retornam em modo local e PDFs sao devolvidos como data URL.

## Banco de dados

Execute `supabase/schema.sql` no SQL Editor do Supabase. Ele cria:

- `clients`
- `invoices`
- `invoice_adjustments`
- `late_fees`
- `user_invoice_settings`
- `user_subscriptions`
- bucket `solar-invoices`

## Assinaturas Stripe

Crie no Stripe tres precos recorrentes mensais em BRL e informe os respectivos Price IDs nas variaveis `STRIPE_PRICE_*`.
O Checkout coleta o cartao antes de iniciar os 3 dias gratis e cobra o primeiro ciclo ao final do teste.

Cadastre o webhook abaixo no Stripe:

```text
https://SEU-DOMINIO/api/billing/webhook
```

Eventos usados:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`

Copie o segredo de assinatura do webhook para `STRIPE_WEBHOOK_SECRET`. Ative o Customer Portal no Stripe para permitir troca de plano, atualizacao do cartao e cancelamento.

## Rotas principais

- `GET /entrar` - login/cadastro com Supabase Auth
- `GET /inicio` - tela inicial do sistema
- `GET /clientes/novo` - cadastro rapido de cliente
- `GET /carregar-fatura` - fluxo de upload, revisao, calculo e PDF
- `POST /api/invoices/extract-pdf`
- `POST /api/clients/upsert`
- `POST /api/invoices/calculate`
- `POST /api/invoices/generate-pdf`
- `POST /api/late-fees`
- `GET /api/late-fees?clientId=`

## Validacao local

```bash
npm run lint
npm run build
```
