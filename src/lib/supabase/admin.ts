import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave secreta: ignora a RLS. Usar somente em Server Actions
 * que já verificaram que quem chama é da equipe ONE.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY não configurada.");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
