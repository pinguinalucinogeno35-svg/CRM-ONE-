-- Busca por nome ignorando acentos e maiúsculas ("joao" encontra "João").

create extension if not exists unaccent with schema extensions;

alter table public.leads add column name_search text not null default '';

create function private.set_lead_name_search()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name_search = lower(extensions.unaccent(new.name));
  return new;
end;
$$;

revoke all on function private.set_lead_name_search() from public, anon;

create trigger leads_set_name_search
  before insert or update of name on public.leads
  for each row execute function private.set_lead_name_search();

update public.leads set name = name;
