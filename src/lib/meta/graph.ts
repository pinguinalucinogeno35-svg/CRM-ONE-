import "server-only";
import { GRAPH_VERSION, type MetaConfig } from "./config";

export class GraphError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly status: number,
  ) {
    super(message);
  }
  /** Token inválido, expirado ou revogado pelo usuário. */
  get isAuth() {
    return this.code === 190 || this.status === 401;
  }
}

type Params = Record<string, string | number | undefined>;

/** GET na Graph API. O token nunca entra em mensagens de erro. */
export async function graphGet<T = Record<string, unknown>>(
  cfg: MetaConfig,
  path: string,
  params: Params,
  accessToken?: string,
): Promise<T> {
  const url = new URL(`${cfg.graphUrl}/${GRAPH_VERSION}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new GraphError("Sem resposta da Meta.", null, 0);
  }

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; code?: number } })
    | null;
  if (!response.ok || !body || body.error) {
    throw new GraphError(body?.error?.message ?? `Erro ${response.status} da Meta.`, body?.error?.code ?? null, response.status);
  }
  return body;
}
