import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave secreta: ignora a RLS. Usar somente em Server Actions
 * que já verificaram que quem chama é da equipe ONE.
 * Devolve null quando a chave não está configurada no servidor.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
