-- Fase 6: temperatura automática do lead e relatório da origem até a venda.

alter table public.leads
  add column temperature_mode text not null default 'auto' check (temperature_mode in ('auto', 'manual')),
  add column temperature_reasons jsonb not null default '[]',
  add column stage_changed_at timestamptz not null default now(),
  add column campaign text not null default '' check (char_length(campaign) <= 120),
  add column sale_value numeric(12, 2) check (sale_value >= 0);

grant update (temperature_mode, campaign, sale_value) on public.leads to authenticated;

create index leads_org_source_idx on public.leads (organization_id, source);

-- ---------------------------------------------------------------------------
-- Pontuação
-- ---------------------------------------------------------------------------

-- Regras em um só lugar. Devolve {score, temperature, reasons:[{label, points}]}.
--   etapa:    Proposta +3, Em contato +1
--   intenção: o motivo fala em preço, orçamento, agendar, comprar... +2
--   origem:   Indicação +2; Anúncio, WhatsApp ou Site +1
--   tempo na etapa: até 2 dias +2; até 7 dias +1; mais de 14 dias -2; mais de 30 dias -4
--   resultado: 4 ou mais = quente; 2 ou 3 = médio; 1 ou menos = frio
create function private.score_lead(p_stage text, p_source text, p_reason text, p_since timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_score int := 0;
  v_reasons jsonb := '[]';
  v_days int := greatest(0, floor(extract(epoch from (now() - p_since)) / 86400))::int;
  v_reason text := lower(extensions.unaccent(coalesce(p_reason, '')));
begin
  if p_stage = 'proposta' then
    v_score := v_score + 3;
    v_reasons := v_reasons || jsonb_build_object('label', 'Está na etapa Proposta', 'points', 3);
  elsif p_stage = 'em_contato' then
    v_score := v_score + 1;
    v_reasons := v_reasons || jsonb_build_object('label', 'Já está em contato', 'points', 1);
  end if;

  if v_reason ~ '(orcamento|preco|valor|quanto custa|quanto e|comprar|contratar|agendar|marcar|fechar|urgente|urgencia)' then
    v_score := v_score + 2;
    v_reasons := v_reasons || jsonb_build_object('label', 'O motivo indica intenção de compra', 'points', 2);
  end if;

  if p_source = 'indicacao' then
    v_score := v_score + 2;
    v_reasons := v_reasons || jsonb_build_object('label', 'Veio por indicação', 'points', 2);
  elsif p_source = 'anuncio' then
    v_score := v_score + 1;
    v_reasons := v_reasons || jsonb_build_object('label', 'Respondeu a um anúncio', 'points', 1);
  elsif p_source = 'whatsapp' then
    v_score := v_score + 1;
    v_reasons := v_reasons || jsonb_build_object('label', 'Chamou no WhatsApp', 'points', 1);
  elsif p_source = 'site' then
    v_score := v_score + 1;
    v_reasons := v_reasons || jsonb_build_object('label', 'Preencheu o formulário do site', 'points', 1);
  end if;

  if v_days <= 2 then
    v_score := v_score + 2;
    v_reasons := v_reasons || jsonb_build_object('label', 'Movimentado nos últimos 2 dias', 'points', 2);
  elsif v_days <= 7 then
    v_score := v_score + 1;
    v_reasons := v_reasons || jsonb_build_object('label', 'Movimentado na última semana', 'points', 1);
  elsif v_days > 30 then
    v_score := v_score - 4;
    v_reasons := v_reasons || jsonb_build_object('label', 'Parado há mais de 30 dias', 'points', -4);
  elsif v_days > 14 then
    v_score := v_score - 2;
    v_reasons := v_reasons || jsonb_build_object('label', 'Parado há mais de 14 dias', 'points', -2);
  end if;

  return jsonb_build_object(
    'score', v_score,
    'temperature', case when v_score >= 4 then 'quente' when v_score >= 2 then 'medio' else 'frio' end,
    'reasons', v_reasons
  );
end;
$$;

revoke all on function private.score_lead(text, text, text, timestamptz) from public, anon;
grant execute on function private.score_lead(text, text, text, timestamptz) to authenticated;

-- Mantém a data da etapa e, no modo automático, a temperatura e seus motivos.
create function private.apply_lead_scoring()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;

  if new.temperature_mode = 'manual' then
    new.temperature_reasons := '[]';
  elsif new.stage not in ('fechado', 'perdido') then
    v_result := private.score_lead(new.stage, new.source, new.reason, new.stage_changed_at);
    new.temperature := v_result ->> 'temperature';
    new.temperature_reasons := v_result -> 'reasons';
  end if;
  return new;
end;
$$;

revoke all on function private.apply_lead_scoring() from public, anon;

create trigger leads_apply_scoring
  before insert or update on public.leads
  for each row execute function private.apply_lead_scoring();

-- "updated_at" passa a registrar só mudanças feitas por pessoas; o
-- esfriamento automático não deve reordenar o funil. O gatilho antigo fica
-- desativado (a remoção dele e das funções antigas está em migração própria).
create function private.set_lead_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.name, new.phone, new.reason, new.source, new.stage, new.notes, new.temperature_mode, new.campaign, new.sale_value)
     is distinct from
     (old.name, old.phone, old.reason, old.source, old.stage, old.notes, old.temperature_mode, old.campaign, old.sale_value)
     or (new.temperature_mode = 'manual' and new.temperature is distinct from old.temperature) then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_lead_updated_at() from public, anon;

alter trigger leads_set_updated_at on public.leads rename to leads_set_updated_at_legacy;
alter table public.leads disable trigger leads_set_updated_at_legacy;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function private.set_lead_updated_at();

-- Reavalia os leads automáticos em aberto do cliente de quem chama (a RLS
-- limita as linhas). Só toca nos que mudariam de temperatura.
create function public.refresh_lead_temperatures()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.leads l
  set stage = l.stage
  where l.temperature_mode = 'auto'
    and l.stage not in ('fechado', 'perdido')
    and l.temperature is distinct from
        (private.score_lead(l.stage, l.source, l.reason, l.stage_changed_at) ->> 'temperature');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_lead_temperatures() from public, anon;
grant execute on function public.refresh_lead_temperatures() to authenticated;

-- ---------------------------------------------------------------------------
-- Relatório: origem e campanha até a venda
-- ---------------------------------------------------------------------------

create function public.lead_report(p_since timestamptz)
returns table (source text, campaign text, leads bigint, open bigint, won bigint, lost bigint, revenue numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.source,
    l.campaign,
    count(*),
    count(*) filter (where l.stage not in ('fechado', 'perdido')),
    count(*) filter (where l.stage = 'fechado'),
    count(*) filter (where l.stage = 'perdido'),
    coalesce(sum(l.sale_value) filter (where l.stage = 'fechado'), 0)
  from public.leads l
  where p_since is null or l.created_at >= p_since
  group by l.source, l.campaign;
$$;

revoke all on function public.lead_report(timestamptz) from public, anon;
grant execute on function public.lead_report(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Captura: versões que também registram a campanha
-- ---------------------------------------------------------------------------

-- As versões novas convivem com as antigas (mesmo nome, um parâmetro a mais),
-- para o site publicado não parar durante a troca.

create function private.capture_lead(
  p_org uuid,
  p_name text,
  p_phone text,
  p_reason text,
  p_source text,
  p_via text,
  p_detail text,
  p_campaign text
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

  insert into public.leads (organization_id, name, phone, reason, source, captured_via, origin_detail, campaign)
  values (
    p_org,
    v_name,
    v_phone,
    left(btrim(coalesce(p_reason, '')), 500),
    case when p_source in ('instagram', 'facebook', 'whatsapp', 'site', 'anuncio', 'indicacao', 'outro')
      then p_source else 'outro' end,
    p_via,
    left(btrim(coalesce(p_detail, '')), 500),
    left(btrim(coalesce(p_campaign, '')), 120)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.capture_lead(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

create function public.submit_public_lead(
  p_token text,
  p_name text,
  p_phone text,
  p_reason text,
  p_source text,
  p_campaign text
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
  return private.capture_lead(v_org, p_name, p_phone, p_reason, p_source, 'formulario', 'Formulário público', p_campaign) is not null;
end;
$$;

revoke all on function public.submit_public_lead(text, text, text, text, text, text) from public, authenticated;
grant execute on function public.submit_public_lead(text, text, text, text, text, text) to anon;

create function public.ingest_channel_lead(
  p_kind text,
  p_external_id text,
  p_name text,
  p_phone text,
  p_reason text,
  p_source text,
  p_detail text,
  p_campaign text
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
  return private.capture_lead(v_org, p_name, p_phone, p_reason, p_source, p_kind, p_detail, p_campaign);
end;
$$;

revoke all on function public.ingest_channel_lead(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ingest_channel_lead(text, text, text, text, text, text, text, text) to service_role;
