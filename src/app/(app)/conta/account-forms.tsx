"use client";

import { useActionState } from "react";
import { changePassword, updateName } from "./actions";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/action-state";

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert>{state.error}</Alert>;
  if (state?.success) return <Alert kind="success">{state.success}</Alert>;
  return null;
}

export function NameForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateName, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome" name="full_name" defaultValue={fullName} autoComplete="name" required maxLength={120} />
      <Feedback state={state} />
      <SubmitButton pendingLabel="Salvando...">Salvar nome</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="Mínimo de 8 caracteres."
      />
      <Field label="Repita a nova senha" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
      <Feedback state={state} />
      <SubmitButton pendingLabel="Alterando...">Alterar senha</SubmitButton>
    </form>
  );
}
