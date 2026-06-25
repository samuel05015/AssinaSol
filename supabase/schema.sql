create extension if not exists "pgcrypto";

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  uc_code text not null,
  name text not null,
  document text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_user_uc_unique unique (user_id, uc_code)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text not null,
  reference_month text not null,
  due_date date not null,
  total_consumption_kwh numeric(12, 3),
  solar_consumption_kwh numeric(12, 3) not null,
  accumulated_credit_kwh numeric(12, 3),
  price_per_kwh numeric(12, 4) not null,
  discount_percent numeric(8, 4) not null default 0,
  discount_value numeric(12, 2) not null default 0,
  energy_subtotal numeric(12, 2) not null,
  energy_total numeric(12, 2) not null,
  fio_b_value numeric(12, 2) not null default 0,
  charge_fio_b boolean not null default false,
  public_lighting_value numeric(12, 2) not null default 0,
  charge_public_lighting boolean not null default false,
  utility_bill_value numeric(12, 2) not null default 0,
  charge_utility_bill boolean not null default false,
  tariff_flag text not null default 'green',
  tariff_flag_value numeric(12, 4) not null default 0,
  estimated_utility_cost numeric(12, 2) not null default 0,
  estimated_savings numeric(12, 2) not null default 0,
  total_extra_fees numeric(12, 2) not null default 0,
  total_extra_discounts numeric(12, 2) not null default 0,
  total_late_fees numeric(12, 2) not null default 0,
  final_total numeric(12, 2) not null,
  pix_key text,
  receiver_name text,
  notes text,
  pdf_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  type text not null check (type in ('fee', 'discount')),
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.late_fees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  original_invoice_reference text not null,
  original_due_date date not null,
  payment_date date not null,
  original_amount numeric(12, 2) not null,
  fine_percent numeric(8, 4) not null default 0,
  interest_percent numeric(8, 4) not null default 0,
  interest_type text not null check (interest_type in ('monthly', 'daily')),
  days_late integer not null default 0,
  fine_amount numeric(12, 2) not null default 0,
  interest_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'included', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_invoice_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  remembered_pdf_password text,
  default_due_day integer check (default_due_day between 1 and 31),
  default_pix_key text,
  default_receiver_name text,
  default_price_per_kwh numeric(12, 4),
  default_discount_percent numeric(8, 4),
  default_fio_b_value numeric(12, 2),
  default_charge_fio_b boolean not null default false,
  default_public_lighting_value numeric(12, 2),
  default_charge_public_lighting boolean not null default false,
  default_charge_utility_bill boolean not null default false,
  tariff_green_value numeric(12, 4) not null default 0,
  tariff_yellow_value numeric(12, 4) not null default 0,
  tariff_red_value numeric(12, 4) not null default 0,
  company_name text,
  company_email text,
  company_phone text,
  company_document text,
  company_logo_url text,
  proposal_color text not null default '#f97316',
  proposal_layout text not null default 'modern' check (proposal_layout in ('modern', 'classic', 'compact')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_invoice_settings
add column if not exists company_name text;

alter table public.user_invoice_settings
add column if not exists company_email text;

alter table public.user_invoice_settings
add column if not exists company_phone text;

alter table public.user_invoice_settings
add column if not exists company_document text;

alter table public.user_invoice_settings
add column if not exists company_logo_url text;

alter table public.user_invoice_settings
add column if not exists proposal_color text not null default '#f97316';

alter table public.user_invoice_settings
add column if not exists proposal_layout text not null default 'modern';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_invoice_settings_proposal_layout_check'
  ) then
    alter table public.user_invoice_settings
    add constraint user_invoice_settings_proposal_layout_check
    check (proposal_layout in ('modern', 'classic', 'compact'));
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists late_fees_set_updated_at on public.late_fees;
create trigger late_fees_set_updated_at
before update on public.late_fees
for each row execute function public.set_updated_at();

drop trigger if exists user_invoice_settings_set_updated_at on public.user_invoice_settings;
create trigger user_invoice_settings_set_updated_at
before update on public.user_invoice_settings
for each row execute function public.set_updated_at();

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_uc_code_idx on public.clients(uc_code);
create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists late_fees_client_status_idx on public.late_fees(client_id, status);

alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_adjustments enable row level security;
alter table public.late_fees enable row level security;
alter table public.user_invoice_settings enable row level security;

drop policy if exists "Users can manage own clients" on public.clients;
create policy "Users can manage own clients"
on public.clients for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own invoices" on public.invoices;
create policy "Users can manage own invoices"
on public.invoices for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own invoice adjustments" on public.invoice_adjustments;
create policy "Users can manage own invoice adjustments"
on public.invoice_adjustments for all
using (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_adjustments.invoice_id
    and invoices.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_adjustments.invoice_id
    and invoices.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own late fees" on public.late_fees;
create policy "Users can manage own late fees"
on public.late_fees for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own invoice settings" on public.user_invoice_settings;
create policy "Users can manage own invoice settings"
on public.user_invoice_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('solar-invoices', 'solar-invoices', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do nothing;
