"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/lib/action-state";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MISSING_KEY = "Chave secreta do Supabase não configurada no servidor (SUPABASE_SECRET_KEY).";

function temporaryPassword() {
  return randomBytes(9).toString("base64url");
}

/**
 * Confirma que o usuário pertence ao cliente informado. As ações abaixo usam a
 * chave secreta, então esta checagem impede agir sobre contas fora do cliente
 * (inclusive contas da equipe ONE).
 */
async function isMemberOfOrganization(organizationId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    return { error: "Informe um nome entre 2 e 120 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").insert({ name }).select("id").single();
  if (error || !data) return { error: "Não foi possível criar o cliente." };

  redirect(`/admin/clientes/${data.id}`);
}

export async function setOrganizationActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("organization_id") ?? "");
  const active = formData.get("active") === "true";
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ is_active: active }).eq("id", id);
  if (error) throw new Error("Não foi possível alterar o status do cliente.");
  refresh();
}

export async function createClientUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const organizationId = String(formData.get("organization_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!UUID.test(organizationId)) return { error: "Cliente inválido." };
  if (fullName.length < 2 || fullName.length > 120) return { error: "Informe o nome do usuário." };
  if (!EMAIL.test(email)) return { error: "Informe um e-mail válido." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (!org) return { error: "Cliente não encontrado." };

  const admin = createAdminClient();
  if (!admin) return { error: MISSING_KEY };
  const password = temporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    return {
      error:
        createError?.code === "email_exists"
          ? "Já existe um usuário com este e-mail."
          : "Não foi possível criar o usuário.",
    };
  }

  const { error: memberError } = await supabase
    .from("memberships")
    .insert({ organization_id: organizationId, user_id: created.user.id, role: "owner" });
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Não foi possível vincular o usuário ao cliente." };
  }

  refresh();
  return { success: "Usuário criado.", credentials: { email, password } };
}

export async function resetUserPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const organizationId = String(formData.get("organization_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!UUID.test(organizationId) || !UUID.test(userId)) return { error: "Usuário inválido." };
  if (!(await isMemberOfOrganization(organizationId, userId))) return { error: "Usuário não pertence a este cliente." };

  const admin = createAdminClient();
  if (!admin) return { error: MISSING_KEY };
  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: "Não foi possível gerar a nova senha." };

  return { success: "Nova senha gerada.", credentials: { email, password } };
}

export async function removeClientUser(formData: FormData) {
  await requireAdmin();
  const organizationId = String(formData.get("organization_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!UUID.test(organizationId) || !UUID.test(userId)) return;
  if (!(await isMemberOfOrganization(organizationId, userId))) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível remover o usuário.");

  // Sem outros vínculos e fora da equipe ONE: a conta deixa de existir.
  const [{ count }, { data: isStaff }] = await Promise.all([
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (count === 0 && !isStaff) {
    await createAdminClient()?.auth.admin.deleteUser(userId);
  }
  refresh();
}

export async function addWhatsAppChannel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const organizationId = String(formData.get("organization_id") ?? "");
  const externalId = String(formData.get("external_id") ?? "").replace(/\s/g, "");
  const label = String(formData.get("label") ?? "").trim();

  if (!UUID.test(organizationId)) return { error: "Cliente inválido." };
  if (!/^[0-9]{5,25}$/.test(externalId)) {
    return { error: "Informe o ID do número (Phone number ID), só com dígitos. Não é o telefone." };
  }
  if (label.length > 80) return { error: "O nome pode ter até 80 caracteres." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("capture_channels")
    .insert({ organization_id: organizationId, kind: "whatsapp", external_id: externalId, label });
  if (error) {
    return {
      error: error.code === "23505" ? "Este número já está ligado a um cliente." : "Não foi possível conectar o número.",
    };
  }
  refresh();
  return { success: "Número conectado." };
}

export async function removeChannel(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("channel_id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("capture_channels").delete().eq("id", id);
  if (error) throw new Error("Não foi possível remover o número.");
  refresh();
}
