-- Fase 3: captura automática de leads (formulário público e WhatsApp).

-- Cada cliente tem um link público de captura identificado por este token.
alter table public.organizations
  add column capture_token text not null unique
  default replace(gen_random_uuid()::text, '-', '');

revoke update on public.organizations from authenticated;
grant update (name, is_active) on public.organizations to authenticated;

alter table public.leads
  add column captured_via text not null default 'manual'
    check (captured_via in ('manual', 'formulario', 'whatsapp', 'lead_ads')),
  add column origin_detail text not null default '' check (char_length(origin_detail) <= 500);

-- Canais externos ligados a um cliente (ex.: número do WhatsApp Business).
create table public.capture_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('whatsapp')),
  -- WhatsApp: o "phone number ID" da Meta, não o número em si.
  external_id text not null check (external_id ~ '^[0-9]{5,25}$'),
  label text not null default '' check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  unique (kind, external_id)
);

create index capture_channels_org_idx on public.capture_channels (organization_id);

revoke all on public.capture_channels from anon, authenticated;
grant select, insert, delete on public.capture_channels to authenticated;
alter table public.capture_channels enable row level security;

create policy "capture_channels: membros e equipe ONE leem"
  on public.capture_channels for select to authenticated
  using ((select private.is_platform_admin()) or (select private.is_member_of(organization_id)));

create policy "capture_channels: equipe ONE cria"
  on public.capture_channels for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy "capture_channels: equipe ONE remove"
  on public.capture_channels for delete to authenticated
  using ((select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Entrada de leads capturados
-- ---------------------------------------------------------------------------

-- Regra única de captura: normaliza, evita duplicar um lead ainda em aberto
-- com o mesmo telefone e limita o volume por cliente (proteção contra spam).
create function private.capture_lead(
  p_org uuid,
  p_name text,
  p_phone text,
  p_reason text,
  p_source text,
  p_via text,
  p_detail text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_id uuid;
begin
  -- Guarda o telefone sem o DDI do Brasil, como no cadastro manual.
  if length(v_phone) > 11 and v_phone like '55%' then
    v_phone := substr(v_phone, 3);
  end if;
  if v_phone !~ '^[0-9]{10,13}$' then
    return null;
  end if;
  if char_length(v_name) < 2 then
    v_name := 'Contato sem nome';
  end if;

  select id into v_id
  from public.leads
  where organization_id = p_org
    and phone = v_phone
    and stage not in ('fechado', 'perdido')
  order by created_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  if (
    select count(*) from public.leads
    where organization_id = p_org
      and captured_via <> 'manual'
      and created_at > now() - interval '10 minutes'
  ) >= 60 then
    return null;
  end if;

  insert into public.leads (organization_id, name, phone, reason, source, captured_via, origin_detail)
  values (
    p_org,
    v_name,
    v_phone,
    left(btrim(coalesce(p_reason, '')), 500),
    case when p_source in ('instagram', 'facebook', 'whatsapp', 'site', 'anuncio', 'indicacao', 'outro')
      then p_source else 'outro' end,
    p_via,
    left(btrim(coalesce(p_detail, '')), 500)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.capture_lead(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- Dados mínimos para montar o formulário público (somente o nome do cliente).
create function public.get_public_form(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select name from public.organizations
  where capture_token = p_token and is_active;
$$;

-- Envio do formulário público. Qualquer visitante pode chamar; só grava se o
-- token for de um cliente ativo. Devolve true quando o contato foi aceito.
create function public.submit_public_lead(
  p_token text,
  p_name text,
  p_phone text,
  p_reason text,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select id into v_org from public.organizations
  where capture_token = p_token and is_active;
  if v_org is null then
    return false;
  end if;
  return private.capture_lead(v_org, p_name, p_phone, p_reason, p_source, 'formulario', 'Formulário público') is not null;
end;
$$;

revoke all on function public.get_public_form(text) from public;
revoke all on function public.submit_public_lead(text, text, text, text, text) from public;
grant execute on function public.get_public_form(text) to anon, authenticated;
grant execute on function public.submit_public_lead(text, text, text, text, text) to anon, authenticated;

-- Entrada de webhooks (WhatsApp). Só o servidor, com a chave secreta, pode chamar.
create function public.ingest_channel_lead(
  p_kind text,
  p_external_id text,
  p_name text,
  p_phone text,
  p_reason text,
  p_source text,
  p_detail text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select c.organization_id into v_org
  from public.capture_channels c
  join public.organizations o on o.id = c.organization_id
  where c.kind = p_kind and c.external_id = p_external_id and o.is_active;
  if v_org is null then
    return null;
  end if;
  return private.capture_lead(v_org, p_name, p_phone, p_reason, p_source, p_kind, p_detail);
end;
$$;

revoke all on function public.ingest_channel_lead(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ingest_channel_lead(text, text, text, text, text, text, text) to service_role;
