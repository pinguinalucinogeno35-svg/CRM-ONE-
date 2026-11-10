-- Fase 4: contas de redes sociais conectadas e histórico diário de métricas.

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook')),
  -- ID da conta na Meta (IG User ID ou Page ID).
  external_id text not null check (external_id ~ '^[0-9]{3,30}$'),
  name text not null default '' check (char_length(name) <= 200),
  username text not null default '' check (char_length(username) <= 100),
  picture_url text not null default '' check (char_length(picture_url) <= 2000),
  -- Token de página cifrado pelo servidor (AES-256-GCM). Inútil sem a chave do servidor.
  token_ciphertext text not null,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text not null default '' check (char_length(last_error) <= 500),
  unique (organization_id, platform, external_id)
);

create index social_accounts_connected_by_idx on public.social_accounts (connected_by);

-- Um registro por conta e por dia. Guardamos para sempre: a Meta só devolve
-- janelas curtas, então o histórico longo existe apenas aqui.
create table public.social_daily_metrics (
  account_id uuid not null references public.social_accounts (id) on delete cascade,
  day date not null,
  followers integer check (followers >= 0),
  reach integer check (reach >= 0),
  views integer check (views >= 0),
  interactions integer check (interactions >= 0),
  engaged integer check (engaged >= 0),
  profile_views integer check (profile_views >= 0),
  updated_at timestamptz not null default now(),
  primary key (account_id, day)
);

create table public.social_posts (
  account_id uuid not null references public.social_accounts (id) on delete cascade,
  external_id text not null check (external_id ~ '^[0-9_]{3,60}$'),
  permalink text not null default '' check (char_length(permalink) <= 2000),
  caption text not null default '' check (char_length(caption) <= 2200),
  media_type text not null default '' check (char_length(media_type) <= 40),
  thumbnail_url text not null default '' check (char_length(thumbnail_url) <= 2000),
  posted_at timestamptz not null,
  likes integer check (likes >= 0),
  comments integer check (comments >= 0),
  reach integer check (reach >= 0),
  views integer check (views >= 0),
  saves integer check (saves >= 0),
  shares integer check (shares >= 0),
  interactions integer check (interactions >= 0),
  updated_at timestamptz not null default now(),
  primary key (account_id, external_id)
);

create index social_posts_account_posted_idx on public.social_posts (account_id, posted_at desc);

create function private.is_member_of_social_account(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.social_accounts a
    where a.id = p_account and private.is_member_of(a.organization_id)
  );
$$;

revoke all on function private.is_member_of_social_account(uuid) from public, anon;
grant execute on function private.is_member_of_social_account(uuid) to authenticated;

revoke all on public.social_accounts, public.social_daily_metrics, public.social_posts from anon, authenticated;
grant select, insert, delete on public.social_accounts to authenticated;
grant update (name, username, picture_url, token_ciphertext, last_synced_at, last_error)
  on public.social_accounts to authenticated;
grant select, insert, update on public.social_daily_metrics, public.social_posts to authenticated;

alter table public.social_accounts enable row level security;
alter table public.social_daily_metrics enable row level security;
alter table public.social_posts enable row level security;

-- A sincronização roda na sessão do próprio cliente, por isso membros escrevem.
create policy "social_accounts: membros e equipe ONE leem"
  on public.social_accounts for select to authenticated
  using ((select private.is_platform_admin()) or (select private.is_member_of(organization_id)));

create policy "social_accounts: membros conectam"
  on public.social_accounts for insert to authenticated
  with check (
    (select private.is_member_of(organization_id))
    and (connected_by is null or connected_by = (select auth.uid()))
  );

create policy "social_accounts: membros atualizam"
  on public.social_accounts for update to authenticated
  using ((select private.is_member_of(organization_id)))
  with check ((select private.is_member_of(organization_id)));

create policy "social_accounts: membros desconectam"
  on public.social_accounts for delete to authenticated
  using ((select private.is_member_of(organization_id)));

create policy "social_daily_metrics: membros e equipe ONE leem"
  on public.social_daily_metrics for select to authenticated
  using ((select private.is_platform_admin()) or (select private.is_member_of_social_account(account_id)));

create policy "social_daily_metrics: membros gravam"
  on public.social_daily_metrics for insert to authenticated
  with check ((select private.is_member_of_social_account(account_id)));

create policy "social_daily_metrics: membros atualizam"
  on public.social_daily_metrics for update to authenticated
  using ((select private.is_member_of_social_account(account_id)))
  with check ((select private.is_member_of_social_account(account_id)));

create policy "social_posts: membros e equipe ONE leem"
  on public.social_posts for select to authenticated
  using ((select private.is_platform_admin()) or (select private.is_member_of_social_account(account_id)));

create policy "social_posts: membros gravam"
  on public.social_posts for insert to authenticated
  with check ((select private.is_member_of_social_account(account_id)));

create policy "social_posts: membros atualizam"
  on public.social_posts for update to authenticated
  using ((select private.is_member_of_social_account(account_id)))
  with check ((select private.is_member_of_social_account(account_id)));
