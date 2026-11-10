"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pendingLabel="Entrando..." className="w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
