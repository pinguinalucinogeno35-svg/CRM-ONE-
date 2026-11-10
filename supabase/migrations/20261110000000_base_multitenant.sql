-- Fase 1: base multi-tenant.
-- Cada cliente da ONE é uma "organization". Usuários enxergam apenas os dados
-- das organizações ativas às quais pertencem; a equipe ONE (platform_admins)
-- enxerga e administra todas.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

-- Equipe ONE. Só pode ser alterada por SQL ou pela chave secreta do servidor.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Aponta para profiles (e não auth.users) para a API conseguir juntar membro e perfil.
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- Funções auxiliares (schema privado, fora da Data API)
-- ---------------------------------------------------------------------------

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid())
  );
$$;

create function private.is_member_of(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and o.is_active
  );
$$;

create function private.shares_organization_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    join public.organizations o on o.id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other_user
      and o.is_active
  );
$$;

-- Cria o perfil automaticamente quando um usuário é criado no Auth.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_member_of(uuid) to authenticated;
grant execute on function private.shares_organization_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Permissões de tabela (a RLS abaixo decide quais linhas)
-- ---------------------------------------------------------------------------

revoke all on public.organizations, public.profiles, public.platform_admins, public.memberships
  from anon, authenticated;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.platform_admins to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.memberships enable row level security;

-- organizations
create policy "organizations: membros e equipe ONE leem"
  on public.organizations for select to authenticated
  using ((select private.is_platform_admin()) or (select private.is_member_of(id)));

create policy "organizations: equipe ONE cria"
  on public.organizations for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy "organizations: equipe ONE altera"
  on public.organizations for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy "organizations: equipe ONE remove"
  on public.organizations for delete to authenticated
  using ((select private.is_platform_admin()));

-- profiles
create policy "profiles: proprio, colegas e equipe ONE leem"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_platform_admin())
    or (select private.shares_organization_with(id))
  );

create policy "profiles: usuario altera o proprio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_admins (somente leitura pela API)
create policy "platform_admins: proprio e equipe ONE leem"
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

-- memberships
create policy "memberships: proprio, colegas e equipe ONE leem"
  on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_platform_admin())
    or (select private.is_member_of(organization_id))
  );

create policy "memberships: equipe ONE cria"
  on public.memberships for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy "memberships: equipe ONE altera"
  on public.memberships for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy "memberships: equipe ONE remove"
  on public.memberships for delete to authenticated
  using ((select private.is_platform_admin()));
