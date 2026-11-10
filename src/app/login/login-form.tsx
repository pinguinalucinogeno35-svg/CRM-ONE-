"use client";

import { signIn } from "./actions";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/use-form-action";

export function LoginForm() {
  const { state, pending, formProps } = useFormAction(signIn);
  return (
    <form {...formProps} className="space-y-4">
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} pendingLabel="Entrando..." className="w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
