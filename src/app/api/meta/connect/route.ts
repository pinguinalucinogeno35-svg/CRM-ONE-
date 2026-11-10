import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { GRAPH_VERSION, META_SCOPES, metaConfig } from "@/lib/meta/config";
import { siteUrl } from "@/lib/site-url";

/** Início da conexão: leva o cliente à tela de autorização da Meta. */
export async function GET() {
  await requireOrganization();
  const cfg = metaConfig();
  if (!cfg) redirect("/redes?erro=nao_configurado");

  const state = randomBytes(24).toString("hex");
  const base = await siteUrl();
  (await cookies()).set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    path: "/api/meta",
    maxAge: 600,
  });

  const url = new URL(`${cfg.dialogUrl}/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", `${base}/api/meta/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));
  redirect(url.toString());
}
