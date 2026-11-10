import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Organization = { id: string; name: string };

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  /** Cliente ativo ao qual o usuário pertence; null para a equipe ONE ou cliente suspenso. */
  organization: Organization | null;
};

/**
 * Ponto único de leitura da sessão. A identidade vem do JWT verificado; papel e
 * organização vêm do banco (sob RLS), nunca de metadados editáveis pelo usuário.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const [profile, admin, membership] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    // A RLS só devolve organizações ativas; se o cliente foi suspenso, vem vazio.
    supabase
      .from("memberships")
      .select("organizations!inner(id, name)")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);

  if (profile.error || admin.error || membership.error) {
    throw new Error("Não foi possível carregar os dados da sessão.");
  }

  const organization = (membership.data?.organizations ?? null) as unknown as Organization | null;

  return {
    userId,
    email: profile.data?.email ?? "",
    fullName: profile.data?.full_name ?? "",
    isAdmin: Boolean(admin.data),
    organization,
  };
});

export async function requireUser(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (!ctx.isAdmin) redirect("/");
  return ctx;
}

/** Para telas do cliente: exige um cliente ativo. A equipe ONE volta ao /admin. */
export async function requireOrganization(): Promise<SessionContext & { organization: Organization }> {
  const ctx = await requireUser();
  if (ctx.isAdmin) redirect("/admin");
  if (!ctx.organization) redirect("/painel");
  return ctx as SessionContext & { organization: Organization };
}
