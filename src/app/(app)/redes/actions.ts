"use server";

import { refresh } from "next/cache";
import { requireOrganization } from "@/lib/auth";
import { metaConfig } from "@/lib/meta/config";
import { SYNC_ACCOUNT_COLUMNS, syncAccount, type SyncAccount } from "@/lib/meta/sync";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Busca os dados mais recentes na Meta para todas as contas do cliente. */
export async function syncSocialAccounts() {
  await requireOrganization();
  const cfg = metaConfig();
  if (!cfg) return;

  const supabase = await createClient();
  const { data } = await supabase.from("social_accounts").select(SYNC_ACCOUNT_COLUMNS);
  for (const account of (data ?? []) as SyncAccount[]) {
    await syncAccount(supabase, cfg, account);
  }
  refresh();
}

export async function disconnectSocialAccount(formData: FormData) {
  await requireOrganization();
  const id = String(formData.get("account_id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").delete().eq("id", id);
  if (error) throw new Error("Não foi possível desconectar a conta.");
  refresh();
}
