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
```

Sem Supabase configurado, o app continua funcionando para preview: a autenticacao fica liberada localmente, clientes retornam em modo local e PDFs sao devolvidos como data URL.

## Banco de dados

Execute `supabase/schema.sql` no SQL Editor do Supabase. Ele cria:

- `clients`
- `invoices`
- `invoice_adjustments`
- `late_fees`
- `user_invoice_settings`
- bucket `solar-invoices`

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
