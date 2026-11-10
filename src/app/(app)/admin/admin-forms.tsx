"use client";

import { useActionState } from "react";
import { createClientUser, createOrganization, resetUserPassword } from "./actions";
import { CredentialsBox } from "./credentials-box";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { IconPlus } from "@/components/icons";

export function NewOrganizationForm() {
  const [state, action] = useActionState(createOrganization, null);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field label="Nome do novo cliente" name="name" required minLength={2} maxLength={120} placeholder="Ex.: Clínica Bem Viver" />
        </div>
        <SubmitButton pendingLabel="Criando...">
          <IconPlus width={16} height={16} /> Criar cliente
        </SubmitButton>
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}

export function NewUserForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(createClientUser, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" name="full_name" required minLength={2} maxLength={120} autoComplete="off" />
        <Field label="E-mail" name="email" type="email" required autoComplete="off" />
      </div>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.credentials ? <CredentialsBox credentials={state.credentials} /> : null}
      <SubmitButton pendingLabel="Criando...">
        <IconPlus width={16} height={16} /> Adicionar usuário
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({
  organizationId,
  userId,
  email,
}: {
  organizationId: string;
  userId: string;
  email: string;
}) {
  const [state, action] = useActionState(resetUserPassword, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="email" value={email} />
      <SubmitButton variant="secondary" pendingLabel="Gerando...">
        Gerar nova senha
      </SubmitButton>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.credentials ? <CredentialsBox credentials={state.credentials} /> : null}
    </form>
  );
}
