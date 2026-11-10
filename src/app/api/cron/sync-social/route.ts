import { timingSafeEqual } from "node:crypto";
import { metaConfig } from "@/lib/meta/config";
import { SYNC_ACCOUNT_COLUMNS, syncAccount, type SyncAccount } from "@/lib/meta/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/** Atualização diária de todas as contas, chamada pelo Cron da Vercel. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const cfg = metaConfig();
  const supabase = createAdminClient();
  if (!secret || !cfg || !supabase) return new Response("Not configured", { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await supabase
    .from("social_accounts")
    .select(`${SYNC_ACCOUNT_COLUMNS}, organizations!inner(is_active)`)
    .eq("organizations.is_active", true);
  if (error) return new Response("Database error", { status: 500 });

  let failed = 0;
  for (const account of (data ?? []) as unknown as SyncAccount[]) {
    const result = await syncAccount(supabase, cfg, account);
    if (!result.ok) failed++;
  }
  return Response.json({ accounts: data?.length ?? 0, failed });
}
