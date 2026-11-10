import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { metaConfig } from "@/lib/meta/config";
import { encryptToken } from "@/lib/meta/crypto";
import { graphGet } from "@/lib/meta/graph";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";

type Found = { platform: "instagram" | "facebook"; external_id: string; name: string; username: string; picture_url: string; token: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

function sameState(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** Retorno da Meta: troca o código por tokens de página e guarda as contas. */
export async function GET(request: Request) {
  const ctx = await requireOrganization();
  const cfg = metaConfig();
  if (!cfg) redirect("/redes?erro=nao_configurado");

  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expected = jar.get("meta_oauth_state")?.value ?? "";
  jar.delete({ name: "meta_oauth_state", path: "/api/meta" });

  if (params.get("error")) redirect("/redes?erro=cancelado");
  const code = params.get("code") ?? "";
  if (!code || !sameState(params.get("state") ?? "", expected)) redirect("/redes?erro=sessao");

  const found: Found[] = [];
  try {
    const short = await graphGet(cfg, "oauth/access_token", {
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      redirect_uri: `${await siteUrl()}/api/meta/callback`,
      code,
    });
    // Token de usuário de longa duração: os tokens de página derivados dele não expiram.
    const long = await graphGet(cfg, "oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: str(short.access_token),
    });
    const pages = await graphGet(
      cfg,
      "me/accounts",
      {
        fields: "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
        limit: 100,
      },
      str(long.access_token),
    );

    for (const page of Array.isArray(pages.data) ? pages.data.map(obj) : []) {
      const token = str(page.access_token);
      const pageId = str(page.id);
      if (!token || !/^[0-9]{3,30}$/.test(pageId)) continue;
      found.push({
        platform: "facebook",
        external_id: pageId,
        name: str(page.name),
        username: "",
        picture_url: str(obj(obj(page.picture).data).url),
        token,
      });
      const ig = obj(page.instagram_business_account);
      const igId = str(ig.id);
      if (/^[0-9]{3,30}$/.test(igId)) {
        found.push({
          platform: "instagram",
          external_id: igId,
          name: str(ig.name),
          username: str(ig.username),
          picture_url: str(ig.profile_picture_url),
          token,
        });
      }
    }
  } catch {
    redirect("/redes?erro=meta");
  }
  if (found.length === 0) redirect("/redes?erro=sem_paginas");

  const supabase = await createClient();
  let saved = 0;
  for (const account of found) {
    const values = {
      name: account.name.slice(0, 200),
      username: account.username.slice(0, 100),
      picture_url: account.picture_url.slice(0, 2000),
      token_ciphertext: encryptToken(account.token, cfg.appSecret),
      last_error: "",
    };
    const { data: existing } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("organization_id", ctx.organization.id)
      .eq("platform", account.platform)
      .eq("external_id", account.external_id)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("social_accounts").update(values).eq("id", existing.id)
      : await supabase.from("social_accounts").insert({
          ...values,
          organization_id: ctx.organization.id,
          platform: account.platform,
          external_id: account.external_id,
          connected_by: ctx.userId,
        });
    if (!error) saved++;
  }

  redirect(saved > 0 ? "/redes?conectado=1" : "/redes?erro=salvar");
}
