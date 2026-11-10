"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { CAMPAIGN_PATTERN, isSource, normalizePhone } from "@/lib/leads";
import type { ActionState } from "@/lib/action-state";

export async function submitPublicLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Campo invisível para pessoas: se vier preenchido, é robô. Finge sucesso.
  if (String(formData.get("empresa_site") ?? "")) return { success: "ok" };

  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();
  const source = formData.get("source");
  const campaign = String(formData.get("campaign") ?? "").trim();

  if (name.length < 2 || name.length > 120) return { error: "Informe seu nome." };
  if (phone.length < 10 || phone.length > 13) return { error: "Informe seu telefone com DDD." };
  if (reason.length > 500) return { error: "A mensagem pode ter até 500 caracteres." };

  const { data, error } = await createPublicClient().rpc("submit_public_lead", {
    p_token: token,
    p_name: name,
    p_phone: phone,
    p_reason: reason,
    p_source: isSource(source) ? source : "site",
    p_campaign: CAMPAIGN_PATTERN.test(campaign) ? campaign : "",
  });
  if (error || data !== true) {
    return { error: "Não foi possível enviar agora. Tente novamente em alguns minutos." };
  }
  return { success: "ok" };
}
