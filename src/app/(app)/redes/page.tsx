import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import { metaConfig } from "@/lib/meta/config";
import { dayKey, nowUnix } from "@/lib/meta/sync";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { LineChart, type ChartPoint } from "@/components/line-chart";
import { disconnectSocialAccount } from "./actions";
import { PostThumb } from "./post-thumb";
import { SyncControls } from "./sync-controls";

export const metadata: Metadata = { title: "Redes sociais" };

type Account = {
  id: string;
  platform: "instagram" | "facebook";
  name: string;
  username: string;
  last_synced_at: string | null;
  last_error: string;
};
type Daily = { day: string; followers: number | null; reach: number | null; views: number | null; interactions: number | null };
type Post = {
  external_id: string;
  permalink: string;
  caption: string;
  media_type: string;
  thumbnail_url: string;
  posted_at: string;
  likes: number | null;
  comments: number | null;
  reach: number | null;
  saves: number | null;
  interactions: number | null;
};

const PERIODS = [7, 30, 90] as const;
const STALE_MS = 6 * 3600 * 1000;
const DAY = 86_400;
const nf = new Intl.NumberFormat("pt-BR");
const platformName = { instagram: "Instagram", facebook: "Facebook" } as const;

const ERRORS: Record<string, string> = {
  nao_configurado: "A conexão com a Meta ainda não foi configurada. Fale com a equipe ONE.",
  cancelado: "A autorização foi cancelada. Nenhuma conta foi conectada.",
  sessao: "A autorização expirou antes de terminar. Tente conectar de novo.",
  meta: "A Meta não concluiu a autorização. Tente de novo em alguns minutos.",
  sem_paginas:
    "Nenhuma Página do Facebook foi autorizada. O Instagram precisa ser uma conta profissional ligada a uma Página, e a Página precisa ser marcada na tela de autorização.",
  salvar: "Não foi possível guardar as contas autorizadas. Tente de novo.",
};

const accountLabel = (a: Account) => (a.username ? `@${a.username}` : a.name || platformName[a.platform]);
const sum = (rows: Daily[], key: "reach" | "views" | "interactions") => {
  const values = rows.flatMap((r) => (r[key] === null ? [] : [r[key] as number]));
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
};

function Kpi({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value === null ? "sem dados" : nf.format(value)}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </Card>
  );
}

/** Variação contra o período anterior, só quando ele tem dados comparáveis. */
function change(current: number | null, previous: number | null, previousDays: number, period: number) {
  if (current === null || previous === null || previous === 0 || previousDays < period / 2) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? "+" : ""}${pct}% em relação aos ${period} dias anteriores`;
}

export default async function RedesPage({ searchParams }: PageProps<"/redes">) {
  await requireOrganization();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const period = PERIODS.find((p) => String(p) === one(sp.periodo)) ?? 30;
  const error = ERRORS[one(sp.erro)];
  const configured = Boolean(metaConfig());

  const supabase = await createClient();
  const { data: accountRows } = await supabase
    .from("social_accounts")
    .select("id, platform, name, username, last_synced_at, last_error")
    .order("platform", { ascending: false })
    .order("name");
  const accounts = (accountRows ?? []) as Account[];

  const connect = (
    <a
      href="/api/meta/connect"
      className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
    >
      {accounts.length ? "Conectar outra conta" : "Conectar Instagram e Facebook"}
    </a>
  );

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Redes sociais" description="Métricas dos seus perfis de Instagram e Facebook." />
        {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
        <Card className="p-8 text-center">
          <p className="font-medium">Nenhuma conta conectada</p>
          {configured ? (
            <>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Você será levado ao Facebook para autorizar a leitura das métricas. O Instagram precisa ser uma conta
                profissional ligada a uma Página do Facebook.
              </p>
              <div className="mt-4">{connect}</div>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">A conexão com a Meta ainda não foi configurada pela equipe ONE.</p>
          )}
        </Card>
      </>
    );
  }

  const selected = accounts.find((a) => a.id === one(sp.conta)) ?? accounts[0];
  const now = nowUnix();
  const today = dayKey(now);
  const days = Array.from({ length: period }, (_, i) => dayKey(now - (period - 1 - i) * DAY));
  const previousStart = dayKey(now - (2 * period - 1) * DAY);

  const [{ data: dailyRows }, { data: postRows }] = await Promise.all([
    supabase
      .from("social_daily_metrics")
      .select("day, followers, reach, views, interactions")
      .eq("account_id", selected.id)
      .gte("day", previousStart)
      .lte("day", today)
      .order("day"),
    selected.platform === "instagram"
      ? supabase
          .from("social_posts")
          .select("external_id, permalink, caption, media_type, thumbnail_url, posted_at, likes, comments, reach, saves, interactions")
          .eq("account_id", selected.id)
          .order("interactions", { ascending: false, nullsFirst: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
  ]);
  const daily = (dailyRows ?? []) as Daily[];
  const posts = (postRows ?? []) as Post[];
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const current = daily.filter((d) => d.day >= days[0]);
  const previous = daily.filter((d) => d.day < days[0]);
  const series = (key: keyof Omit<Daily, "day">): ChartPoint[] => days.map((day) => ({ day, value: byDay.get(day)?.[key] ?? null }));

  const followerPoints = current.filter((d) => d.followers !== null);
  const followers = followerPoints.at(-1)?.followers ?? null;
  const followersDelta = followerPoints.length >= 2 ? (followers as number) - (followerPoints[0].followers as number) : null;
  const totals = { reach: sum(current, "reach"), views: sum(current, "views"), interactions: sum(current, "interactions") };
  const before = { reach: sum(previous, "reach"), views: sum(previous, "views"), interactions: sum(previous, "interactions") };
  const previousDays = previous.filter((d) => d.reach !== null || d.views !== null).length;

  const stale = configured && accounts.some((a) => !a.last_synced_at || now * 1000 - Date.parse(a.last_synced_at) > STALE_MS);
  const lastSynced = selected.last_synced_at
    ? `Atualizado em ${new Date(selected.last_synced_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}`
    : "Ainda não atualizado";
  const href = (conta: string, p: number) => `/redes?conta=${conta}&periodo=${p}`;
  const pill = (active: boolean) =>
    `inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition ${active ? "bg-ink text-accent-ink" : "border border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <>
      <PageHeader title="Redes sociais" description="Dados lidos da Meta e guardados aqui dia a dia." action={connect} />

      {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
      {one(sp.conectado) ? <div className="mb-4"><Alert kind="success">Conta conectada. Os primeiros dados estão sendo buscados.</Alert></div> : null}
      {selected.last_error ? <div className="mb-4"><Alert kind="warn">{selected.last_error}</Alert></div> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Contas" className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <Link key={a.id} href={href(a.id, period)} aria-current={a.id === selected.id ? "page" : undefined} className={pill(a.id === selected.id)}>
              {platformName[a.platform]} · {accountLabel(a)}
            </Link>
          ))}
        </nav>
        <nav aria-label="Período" className="flex gap-2">
          {PERIODS.map((p) => (
            <Link key={p} href={href(selected.id, p)} aria-current={p === period ? "true" : undefined} className={pill(p === period)}>
              {p} dias
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-4 flex justify-end">
        <SyncControls auto={stale} lastSynced={lastSynced} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Seguidores"
          value={followers}
          note={followersDelta === null ? undefined : `${followersDelta > 0 ? "+" : ""}${nf.format(followersDelta)} no período`}
        />
        <Kpi label="Alcance" value={totals.reach} note={change(totals.reach, before.reach, previousDays, period) ?? "Soma do alcance de cada dia"} />
        <Kpi label="Visualizações" value={totals.views} note={change(totals.views, before.views, previousDays, period)} />
        <Kpi label="Interações" value={totals.interactions} note={change(totals.interactions, before.interactions, previousDays, period)} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {(
          [
            ["Seguidores", "followers", false],
            ["Alcance por dia", "reach", true],
            ["Visualizações por dia", "views", true],
            ["Interações por dia", "interactions", true],
          ] as const
        ).map(([title, key, fromZero]) => (
          <Card key={key} className="p-5">
            <h2 className="mb-3 font-semibold">{title}</h2>
            <LineChart title={title} points={series(key)} fromZero={fromZero} />
          </Card>
        ))}
      </div>

      {selected.platform === "instagram" ? (
        <Card className="mb-4 p-5">
          <h2 className="font-semibold">Melhores publicações recentes</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Entre as 25 últimas, ordenadas por interações.</p>
          {posts.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma publicação lida ainda.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.external_id} className="overflow-hidden rounded-xl border border-line">
                  <a href={post.permalink || undefined} target="_blank" rel="noreferrer" className="block">
                    <div className="aspect-square bg-line/60">
                      <PostThumb src={post.thumbnail_url} />
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-muted">
                        {new Date(post.posted_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </p>
                      <p className="mt-1 line-clamp-2 min-h-10 text-sm">{post.caption || "Sem legenda"}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {(
                          [
                            ["Interações", post.interactions],
                            ["Alcance", post.reach],
                            ["Curtidas", post.likes],
                            ["Comentários", post.comments],
                            ["Salvamentos", post.saves],
                          ] as const
                        ).map(([label, value]) =>
                          value === null ? null : (
                            <div key={label} className="flex justify-between gap-2">
                              <dt className="text-muted">{label}</dt>
                              <dd className="font-medium tabular-nums">{nf.format(value)}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card className="p-5">
        <details>
          <summary className="cursor-pointer select-none text-sm font-medium">
            Desconectar {platformName[selected.platform]} · {accountLabel(selected)}
          </summary>
          <p className="mb-3 mt-2 text-sm text-muted">
            Remove a conta e apaga o histórico de métricas guardado aqui. Não pode ser desfeito.
          </p>
          <form action={disconnectSocialAccount}>
            <input type="hidden" name="account_id" value={selected.id} />
            <SubmitButton variant="danger" pendingLabel="Desconectando...">
              Desconectar e apagar histórico
            </SubmitButton>
          </form>
        </details>
      </Card>
    </>
  );
}
