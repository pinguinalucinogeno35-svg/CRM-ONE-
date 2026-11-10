"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSource, isStage, isTemperature, normalizePhone, parseMoney } from "@/lib/leads";
import type { ActionState } from "@/lib/action-state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireOrganization();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const source = formData.get("source");
  const temperature = formData.get("temperature");
  const stage = formData.get("stage");
  const back = formData.get("back") === "funil" ? "/funil" : "/leads";

  if (name.length < 2 || name.length > 120) return { error: "Informe o nome do lead." };
  if (phone.length < 10 || phone.length > 13) return { error: "Informe o telefone com DDD." };
  if (reason.length > 500) return { error: "O motivo do contato pode ter até 500 caracteres." };
  if (notes.length > 2000) return { error: "As observações podem ter até 2000 caracteres." };
  const campaign = String(formData.get("campaign") ?? "").trim();
  const saleValue = parseMoney(String(formData.get("sale_value") ?? ""));
  const auto = temperature === "auto";
  if (!isSource(source) || !(auto || isTemperature(temperature)) || !isStage(stage)) {
    return { error: "Opção inválida. Recarregue a página e tente de novo." };
  }
  if (campaign.length > 120) return { error: "A campanha pode ter até 120 caracteres." };
  if (saleValue === "invalid") return { error: "Informe o valor da venda em reais, por exemplo 1.500,00." };

  // No modo automático o banco calcula a temperatura a partir das regras.
  const values = {
    name,
    phone,
    reason,
    notes,
    source,
    stage,
    campaign,
    sale_value: saleValue,
    temperature_mode: auto ? "auto" : "manual",
    ...(auto ? {} : { temperature }),
  };
  const supabase = await createClient();

  if (id) {
    if (!UUID.test(id)) return { error: "Lead inválido." };
    const { data, error } = await supabase.from("leads").update(values).eq("id", id).select("id");
    if (error || !data?.length) return { error: "Não foi possível salvar o lead." };
  } else {
    const { error } = await supabase
      .from("leads")
      .insert({ ...values, organization_id: ctx.organization.id, created_by: ctx.userId });
    if (error) return { error: "Não foi possível criar o lead." };
  }

  redirect(back);
}

export async function deleteLead(formData: FormData) {
  await requireOrganization();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o lead.");
  redirect("/leads");
}

/** Usada pelo funil ao arrastar um cartão. Devolve false se nada mudou no banco. */
export async function moveLead(id: string, stage: string): Promise<boolean> {
  await requireOrganization();
  if (!UUID.test(id) || !isStage(stage)) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update({ stage }).eq("id", id).select("id");
  refresh();
  return !error && Boolean(data?.length);
}
