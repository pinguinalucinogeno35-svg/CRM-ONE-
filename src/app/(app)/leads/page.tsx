import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { TemperatureBadge } from "@/components/lead-badges";
import {
  LEAD_COLUMNS,
  SOURCES,
  STAGES,
  TEMPERATURES,
  formatPhone,
  isSource,
  isStage,
  isTemperature,
  labelOf,
  type Lead,
} from "@/lib/leads";

export const metadata: Metadata = { title: "Leads" };

const LIMIT = 200;
const control = "h-10 rounded-lg border border-line bg-surface px-3 text-sm";

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select name={name} defaultValue={value} aria-label={label} className={control}>
      <option value="">{label}: todas</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  await requireOrganization();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().slice(0, 80);
  const temperature = one(sp.temperatura);
  const stage = one(sp.etapa);
  const source = one(sp.origem);
  const filtering = Boolean(q || temperature || stage || source);

  const supabase = await createClient();
  let query = supabase.from("leads").select(LEAD_COLUMNS).order("created_at", { ascending: false }).limit(LIMIT);
  if (isTemperature(temperature)) query = query.eq("temperature", temperature);
  if (isStage(stage)) query = query.eq("stage", stage);
  if (isSource(source)) query = query.eq("source", source);
  if (q) {
    // Remove caracteres com significado na sintaxe de filtro da API.
    const term = q
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[,()%*\\"]/g, " ")
      .trim();
    const digits = term.replace(/\D/g, "");
    const parts = [`name_search.ilike.%${term}%`];
    if (digits.length >= 3) parts.push(`phone.ilike.%${digits}%`);
    if (term) query = query.or(parts.join(","));
  }
  const { data, error } = await query;
  const leads = (data ?? []) as Lead[];

  return (
    <>
      <PageHeader
        title="Leads"
        description="Todos os contatos da sua empresa."
        action={
          <Link
            href="/leads/novo"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            <IconPlus width={16} height={16} /> Novo lead
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar por nome ou telefone"
          className={`${control} min-w-56 flex-1 placeholder:text-muted/70`}
        />
        <FilterSelect name="temperatura" label="Temperatura" value={temperature} options={TEMPERATURES} />
        <FilterSelect name="etapa" label="Etapa" value={stage} options={STAGES} />
        <FilterSelect name="origem" label="Origem" value={source} options={SOURCES} />
        <button type="submit" className={`${control} font-medium hover:bg-bg`}>
          Filtrar
        </button>
        {filtering ? (
          <Link href="/leads" className="inline-flex h-10 items-center px-2 text-sm text-muted hover:text-ink">
            Limpar
          </Link>
        ) : null}
      </form>

      {error ? <Alert>Não foi possível carregar os leads.</Alert> : null}

      {!error && leads.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium">{filtering ? "Nenhum lead encontrado" : "Nenhum lead ainda"}</p>
          <p className="mt-1 text-sm text-muted">
            {filtering ? "Tente outros filtros." : "Cadastre o primeiro contato em Novo lead."}
          </p>
        </Card>
      ) : null}

      {leads.length > 0 ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 font-medium">Telefone</th>
                <th className="px-3 py-3 font-medium">Origem</th>
                <th className="px-3 py-3 font-medium">Etapa</th>
                <th className="px-5 py-3 font-medium">Temperatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((lead) => (
                <tr key={lead.id} className="transition hover:bg-bg">
                  <td className="max-w-64 px-5 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.name}
                    </Link>
                    {lead.reason ? <p className="truncate text-muted">{lead.reason}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatPhone(lead.phone)}</td>
                  <td className="px-3 py-3">{labelOf(SOURCES, lead.source)}</td>
                  <td className="px-3 py-3">{labelOf(STAGES, lead.stage)}</td>
                  <td className="px-5 py-3">
                    <TemperatureBadge value={lead.temperature} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {leads.length === LIMIT ? (
        <p className="mt-3 text-xs text-muted">Mostrando os {LIMIT} leads mais recentes. Use a busca para encontrar os demais.</p>
      ) : null}
    </>
  );
}
