import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente sem sessão (papel anon), para páginas públicas como o formulário de captura. */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
