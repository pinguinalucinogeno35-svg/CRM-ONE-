import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import { dayKey, nowUnix } from "@/lib/meta/sync";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { SOURCES, formatMoney, labelOf } from "@/lib/leads";

export const metadata: Metadata = { title: "Resultados" };

type Row = { source: string; campaign: string; leads: number; open: number; won: number; lost: number; revenue: number };
type Group = Omit<Row, "source" | "campaign"> & { key: string; label: string; detail?: string };

const PERIODS = [
  { value: "30", label: "30 dias", days: 30 },
  { value: "90", label: "90 dias", days: 90 },
  { value: "365", label: "12 meses", days: 365 },
  { value: "tudo", label: "Tudo", days: null },
] as const;
const nf = new Intl.NumberFormat("pt-BR");
const pct = (won: number, leads: number) => (leads ? `${Math.round((won / leads) * 100)}%` : "0%");

function group(rows: Row[], keyOf: (r: Row) => string, labelOf_: (r: Row) => string, detailOf?: (r: Row) => string) {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const key = keyOf(r);
    const g = map.get(key) ?? { key, label: labelOf_(r), detail: detailOf?.(r), leads: 0, open: 0, won: 0, lost: 0, revenue: 0 };
    g.leads += r.leads;
    g.open += r.open;
    g.won += r.won;
    g.lost += r.lost;
    g.revenue += r.revenue;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads || b.won - a.won);
}

function ResultsTable({ caption, first, groups }: { caption: string; first: string; groups: Group[] }) {
  const max = Math.max(1, ...groups.map((g) => g.leads));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-5 py-3 font-medium">{first}</th>
            <th className="w-[26%] px-3 py-3 font-medium">Leads</th>
            <th className="px-3 py-3 text-right font-medium">Em aberto</th>
            <th className="px-3 py-3 text-right font-medium">Vendas</th>
            <th className="px-3 py-3 text-right font-medium">Perdidos</th>
            <th className="px-3 py-3 text-right font-medium">Conversão</th>
            <th className="px-5 py-3 text-right font-medium">Valor vendido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {groups.map((g) => (
            <tr key={g.key}>
              <td className="max-w-56 px-5 py-3">
                <p className="truncate font-medium">{g.label}</p>
                {g.detail ? <p className="truncate text-xs text-muted">{g.detail}</p> : null}
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-right">{nf.format(g.leads)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[var(--series)]" style={{ width: `${(g.leads / max) * 100}%` }} />
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-right">{nf.format(g.open)}</td>
              <td className="px-3 py-3 text-right font-medium">{nf.format(g.won)}</td>
              <td className="px-3 py-3 text-right">{nf.format(g.lost)}</td>
              <td className="px-3 py-3 text-right">{pct(g.won, g.leads)}</td>
              <td className="px-5 py-3 text-right">{formatMoney(g.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ResultadosPage({ searchParams }: PageProps<"/resultados">) {
  await requireOrganization();
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.value === (Array.isArray(sp.periodo) ? sp.periodo[0] : sp.periodo)) ?? PERIODS[1];
  const now = nowUnix();
  const since = period.days === null ? null : new Date((now - period.days * 86_400) * 1000).toISOString();

  const supabase = await createClient();
  const [{ data, error }, { data: accounts }] = await Promise.all([
    supabase.rpc("lead_report", { p_since: since }),
    supabase.from("social_accounts").select("id, platform"),
  ]);
  const rows = ((data ?? []) as Row[]).map((r) => ({ ...r, revenue: Number(r.revenue) }));

  const bySource = group(rows, (r) => r.source, (r) => labelOf(SOURCES, r.source));
  const byCampaign = group(
    rows.filter((r) => r.campaign),
    (r) => `${r.source}|${r.campaign}`,
    (r) => r.campaign,
    (r) => labelOf(SOURCES, r.source),
  );
  const total = bySource.reduce((a, g) => ({ leads: a.leads + g.leads, won: a.won + g.won, revenue: a.revenue + g.revenue }), { leads: 0, won: 0, revenue: 0 });

  // Do alcance à venda: soma o alcance diário guardado de cada rede conectada.
  const reachByPlatform = new Map<string, number>();
  if (accounts?.length) {
    let query = supabase.from("social_daily_metrics").select("account_id, reach").not("reach", "is", null).limit(5000);
    if (period.days !== null) query = query.gte("day", dayKey(now - period.days * 86_400));
    const { data: reach } = await query;
    const platformOf = new Map(accounts.map((a) => [a.id, a.platform as string]));
    for (const r of reach ?? []) {
      const platform = platformOf.get(r.account_id);
      if (platform) reachByPlatform.set(platform, (reachByPlatform.get(platform) ?? 0) + (r.reach ?? 0));
    }
  }
  const journeys = (["instagram", "facebook"] as const)
    .filter((p) => reachByPlatform.has(p))
    .map((p) => ({ platform: p, reach: reachByPlatform.get(p) ?? 0, ...(bySource.find((g) => g.key === p) ?? { leads: 0, won: 0, revenue: 0 }) }));

  return (
    <>
      <PageHeader title="Resultados" description="De onde vêm os leads e quais origens viram venda." />

      <nav aria-label="Período" className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/resultados?periodo=${p.value}`}
            aria-current={p.value === period.value ? "true" : undefined}
            className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition ${
              p.value === period.value ? "bg-ink text-accent-ink" : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {error ? <Alert>Não foi possível carregar os resultados.</Alert> : null}

      {!error && total.leads === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium">Nenhum lead neste período</p>
          <p className="mt-1 text-sm text-muted">Os resultados aparecem conforme os leads chegam e são fechados no funil.</p>
        </Card>
      ) : null}

      {total.leads > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(
              [
                ["Leads", nf.format(total.leads), "Criados no período"],
                ["Vendas", nf.format(total.won), "Leads na etapa Fechado"],
                ["Conversão", pct(total.won, total.leads), "Vendas divididas por leads"],
                ["Valor vendido", formatMoney(total.revenue), "Soma do valor das vendas"],
              ] as const
            ).map(([label, value, note]) => (
              <Card key={label} className="p-5">
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted">{note}</p>
              </Card>
            ))}
          </div>

          {journeys.length > 0 ? (
            <Card className="mb-4 p-5">
              <h2 className="font-semibold">Do alcance à venda</h2>
              <p className="mb-4 mt-1 text-sm text-muted">Quantas pessoas a rede alcançou, quantas viraram lead e quantas compraram.</p>
              <ul className="space-y-3">
                {journeys.map((j) => (
                  <li key={j.platform} className="grid grid-cols-2 gap-3 rounded-xl border border-line p-4 text-sm sm:grid-cols-5 sm:items-center">
                    <p className="col-span-2 font-medium sm:col-span-1">{labelOf(SOURCES, j.platform)}</p>
                    {(
                      [
                        ["Alcance", nf.format(j.reach)],
                        ["Leads", nf.format(j.leads)],
                        ["Vendas", nf.format(j.won)],
                        ["Valor vendido", formatMoney(j.revenue)],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted">{label}</p>
                        <p className="font-semibold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Alcance é a soma do alcance de cada dia guardado em Redes.</p>
            </Card>
          ) : null}

          <Card className="mb-4">
            <h2 className="px-5 pt-5 font-semibold">Por origem</h2>
            <ResultsTable caption="Resultados por origem do contato" first="Origem" groups={bySource} />
          </Card>

          <Card>
            <h2 className="px-5 pt-5 font-semibold">Por campanha ou anúncio</h2>
            {byCampaign.length > 0 ? (
              <ResultsTable caption="Resultados por campanha ou anúncio" first="Campanha" groups={byCampaign} />
            ) : (
              <p className="px-5 pb-5 pt-2 text-sm text-muted">
                Nenhum lead com campanha no período. Crie links de campanha em Captação, ou preencha a campanha no lead.
              </p>
            )}
          </Card>
        </>
      ) : null}
    </>
  );
}
