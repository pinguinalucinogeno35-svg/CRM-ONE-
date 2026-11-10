-- Fase 2: leads e funil de vendas.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  -- Somente dígitos, com DDD (e DDI opcional).
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  reason text not null default '' check (char_length(reason) <= 500),
  source text not null default 'outro'
    check (source in ('instagram', 'facebook', 'whatsapp', 'site', 'anuncio', 'indicacao', 'outro')),
  temperature text not null default 'medio' check (temperature in ('quente', 'medio', 'frio')),
  stage text not null default 'novo'
    check (stage in ('novo', 'em_contato', 'proposta', 'fechado', 'perdido')),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_org_stage_idx on public.leads (organization_id, stage);
create index leads_org_created_idx on public.leads (organization_id, created_at desc);
create index leads_created_by_idx on public.leads (created_by);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function private.set_updated_at();

revoke all on function private.set_updated_at() from public, anon;

revoke all on public.leads from anon, authenticated;
grant select, insert, delete on public.leads to authenticated;
-- organization_id, created_by e created_at não podem ser alterados depois de criados.
grant update (name, phone, reason, source, temperature, stage, notes) on public.leads to authenticated;

alter table public.leads enable row level security;

create policy "leads: membros e equipe ONE leem"
  on public.leads for select to authenticated
  using ((select private.is_platform_admin()) or (select private.is_member_of(organization_id)));

create policy "leads: membros criam no proprio cliente"
  on public.leads for insert to authenticated
  with check (
    (select private.is_member_of(organization_id))
    and (created_by is null or created_by = (select auth.uid()))
  );

create policy "leads: membros alteram"
  on public.leads for update to authenticated
  using ((select private.is_member_of(organization_id)))
  with check ((select private.is_member_of(organization_id)));

create policy "leads: membros removem"
  on public.leads for delete to authenticated
  using ((select private.is_member_of(organization_id)));
