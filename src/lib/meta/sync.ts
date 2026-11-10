import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaConfig } from "./config";
import { decryptToken } from "./crypto";
import { GraphError, graphGet } from "./graph";

export type SyncAccount = {
  id: string;
  platform: "instagram" | "facebook";
  external_id: string;
  token_ciphertext: string;
  last_synced_at: string | null;
};

const DAY = 86_400;
const MAX_DAYS = 30;
// Os dias são contados no horário de Brasília (UTC-3, sem horário de verão).
const BRT_OFFSET = 3 * 3600;

export const dayKey = (unix: number) => new Date((unix - BRT_OFFSET) * 1000).toISOString().slice(0, 10);
const dayStart = (key: string) => Date.parse(`${key}T00:00:00Z`) / 1000 + BRT_OFFSET;
export const nowUnix = () => Math.floor(Date.now() / 1000);

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);

/** Dias completos a (re)buscar. A Meta pode atrasar dados em até 48h, então os últimos 3 são sempre refeitos. */
function daysToSync(lastSyncedAt: string | null) {
  const yesterday = dayStart(dayKey(nowUnix())) - DAY;
  let count = MAX_DAYS;
  if (lastSyncedAt) {
    const since = Math.ceil((nowUnix() - Date.parse(lastSyncedAt) / 1000) / DAY);
    count = Math.min(MAX_DAYS, Math.max(3, since + 3));
  }
  return Array.from({ length: count }, (_, i) => yesterday - i * DAY).reverse();
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run));
  }
}

/** Só as métricas que vieram: uma ausente não apaga o valor já guardado. */
function present(values: Record<string, number | null | undefined>) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined));
}

/** Lê o valor de um item de insights nos dois formatos que a API devolve. */
function insightValue(item: Record<string, unknown>) {
  const total = num(obj(item.total_value).value);
  if (total !== null) return total;
  return num(arr(item.values)[0]?.value);
}

type Ctx = {
  supabase: SupabaseClient;
  cfg: MetaConfig;
  account: SyncAccount;
  token: string;
  /** Falhas pontuais de métricas, e quantas leituras de métricas deram certo. */
  problems: string[];
  stats: { ok: number };
};

async function syncInstagram({ supabase, cfg, account, token, problems, stats }: Ctx) {
  const id = account.external_id;

  const profile = await graphGet(cfg, id, { fields: "username,name,profile_picture_url,followers_count" }, token);
  await supabase
    .from("social_accounts")
    .update({ username: str(profile.username), name: str(profile.name), picture_url: str(profile.profile_picture_url) })
    .eq("id", account.id);
  await supabase
    .from("social_daily_metrics")
    .upsert({ account_id: account.id, day: dayKey(nowUnix()), followers: num(profile.followers_count), updated_at: new Date().toISOString() });

  await inBatches(daysToSync(account.last_synced_at), 5, async (start) => {
    try {
      const res = await graphGet(
        cfg,
        `${id}/insights`,
        {
          metric: "reach,views,accounts_engaged,total_interactions",
          period: "day",
          metric_type: "total_value",
          since: start,
          until: start + DAY - 1,
        },
        token,
      );
      const byName = new Map(arr(res.data).map((item) => [str(item.name), insightValue(item)]));
      stats.ok++;
      // Conjunto vazio significa "dado indisponível", não zero: não grava nada.
      if (byName.size === 0) return;
      await supabase.from("social_daily_metrics").upsert({
        account_id: account.id,
        day: dayKey(start),
        ...present({
          reach: byName.get("reach"),
          views: byName.get("views"),
          engaged: byName.get("accounts_engaged"),
          interactions: byName.get("total_interactions"),
        }),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      if (e instanceof GraphError && e.isAuth) throw e;
      problems.push(e instanceof Error ? e.message : "erro");
    }
  });

  const media = await graphGet(
    cfg,
    `${id}/media`,
    {
      fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count",
      limit: 25,
    },
    token,
  );
  await inBatches(arr(media.data), 5, async (m) => {
    const mediaId = str(m.id);
    const postedAt = Date.parse(str(m.timestamp));
    if (!/^[0-9_]{3,60}$/.test(mediaId) || Number.isNaN(postedAt)) return;

    const metrics = new Map<string, number | null>();
    try {
      const res = await graphGet(cfg, `${mediaId}/insights`, { metric: "reach,views,saved,shares,total_interactions" }, token);
      for (const item of arr(res.data)) metrics.set(str(item.name), insightValue(item));
    } catch (e) {
      if (e instanceof GraphError && e.isAuth) throw e;
      // Publicações antigas ou de álbum podem não ter insights; guardamos só os dados públicos.
    }

    const isVideo = str(m.media_type) === "VIDEO";
    await supabase.from("social_posts").upsert({
      account_id: account.id,
      external_id: mediaId,
      permalink: str(m.permalink).slice(0, 2000),
      caption: str(m.caption).slice(0, 2200),
      media_type: (str(m.media_product_type) || str(m.media_type)).slice(0, 40),
      thumbnail_url: (str(m.thumbnail_url) || (isVideo ? "" : str(m.media_url))).slice(0, 2000),
      posted_at: new Date(postedAt).toISOString(),
      likes: num(m.like_count),
      comments: num(m.comments_count),
      reach: metrics.get("reach") ?? null,
      views: metrics.get("views") ?? null,
      saves: metrics.get("saved") ?? null,
      shares: metrics.get("shares") ?? null,
      interactions: metrics.get("total_interactions") ?? null,
      updated_at: new Date().toISOString(),
    });
  });
}

// Métricas de Página que seguem válidas na v27. Cada uma é pedida sozinha
// porque a Meta vem descontinuando métricas de Página: uma inválida não derruba as outras.
const PAGE_METRICS = {
  page_total_media_view_unique: "reach",
  page_media_view: "views",
  page_post_engagements: "interactions",
  page_views_total: "profile_views",
} as const;

async function syncFacebook({ supabase, cfg, account, token, problems, stats }: Ctx) {
  const id = account.external_id;

  const page = await graphGet(cfg, id, { fields: "name,followers_count,fan_count,picture{url}" }, token);
  await supabase
    .from("social_accounts")
    .update({ name: str(page.name), picture_url: str(obj(obj(page.picture).data).url) })
    .eq("id", account.id);
  await supabase.from("social_daily_metrics").upsert({
    account_id: account.id,
    day: dayKey(nowUnix()),
    followers: num(page.followers_count) ?? num(page.fan_count),
    updated_at: new Date().toISOString(),
  });

  const days = daysToSync(account.last_synced_at);
  const rows = new Map<string, Record<string, number>>();
  for (const [metric, column] of Object.entries(PAGE_METRICS)) {
    try {
      const res = await graphGet(
        cfg,
        `${id}/insights`,
        { metric, period: "day", since: days[0], until: days[days.length - 1] + DAY },
        token,
      );
      stats.ok++;
      for (const point of arr(arr(res.data)[0]?.values)) {
        const end = Date.parse(str(point.end_time));
        const value = num(point.value);
        if (Number.isNaN(end) || value === null) continue;
        // end_time marca o fim do dia medido.
        const key = dayKey(end / 1000 - DAY);
        rows.set(key, { ...rows.get(key), [column]: value });
      }
    } catch (e) {
      if (e instanceof GraphError && e.isAuth) throw e;
      problems.push(e instanceof Error ? e.message : "erro");
    }
  }
  await inBatches([...rows], 5, async ([day, values]) => {
    await supabase
      .from("social_daily_metrics")
      .upsert({ account_id: account.id, day, ...values, updated_at: new Date().toISOString() });
  });
}

/** Sincroniza uma conta e registra o resultado nela. Nunca lança. */
export async function syncAccount(supabase: SupabaseClient, cfg: MetaConfig, account: SyncAccount) {
  const problems: string[] = [];
  let error = "";

  const token = decryptToken(account.token_ciphertext, cfg.appSecret);
  if (!token) {
    error = "Conexão inválida. Conecte a conta novamente.";
  } else {
    try {
      const ctx = { supabase, cfg, account, token, problems, stats: { ok: 0 } };
      await (account.platform === "instagram" ? syncInstagram(ctx) : syncFacebook(ctx));
      // Falhas pontuais (um dia, uma métrica descontinuada) não viram aviso para
      // o cliente; só quando nenhuma métrica veio.
      if (problems.length && ctx.stats.ok === 0) {
        error = `A Meta não devolveu métricas nesta atualização: ${problems[0]}`;
      }
    } catch (e) {
      error =
        e instanceof GraphError && e.isAuth
          ? "A conexão expirou ou foi removida. Conecte a conta novamente."
          : `Não foi possível atualizar: ${e instanceof Error ? e.message : "erro desconhecido"}`;
    }
  }

  await supabase
    .from("social_accounts")
    .update({ last_synced_at: new Date().toISOString(), last_error: error.slice(0, 500) })
    .eq("id", account.id);
  return { ok: !error, error };
}

export const SYNC_ACCOUNT_COLUMNS = "id, platform, external_id, token_ciphertext, last_synced_at";
