"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

export async function updateName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2 || fullName.length > 120) {
    return { error: "Informe um nome entre 2 e 120 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", ctx.userId);
  if (error) return { error: "Não foi possível salvar o nome." };

  refresh();
  return { success: "Nome atualizado." };
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirmation) return { error: "As senhas não são iguais." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "A nova senha precisa ser diferente da atual."
          : error.code === "weak_password"
            ? "Senha fraca. Use uma senha mais longa, com letras e números."
            : "Não foi possível alterar a senha.",
    };
  }
  return { success: "Senha alterada." };
}
