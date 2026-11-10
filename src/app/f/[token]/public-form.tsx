"use client";

import { submitPublicLead } from "./actions";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/use-form-action";
import { IconDone } from "@/components/icons";

export function PublicForm({ token, source, campaign }: { token: string; source: string; campaign: string }) {
  const { state, pending, formProps } = useFormAction(submitPublicLead);

  if (state?.success) {
    return (
      <div className="py-6 text-center" role="status">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-positive-bg text-positive">
          <IconDone />
        </span>
        <p className="font-semibold">Recebemos seu contato</p>
        <p className="mt-1 text-sm text-muted">Em breve entraremos em contato pelo telefone informado.</p>
      </div>
    );
  }

  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="campaign" value={campaign} />
      <div className="hidden" aria-hidden="true">
        <label>
          Não preencha este campo
          <input type="text" name="empresa_site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Nome" name="name" required minLength={2} maxLength={120} autoComplete="name" />
      <Field
        label="Telefone / WhatsApp"
        name="phone"
        type="tel"
        inputMode="tel"
        required
        placeholder="(11) 91234-5678"
        autoComplete="tel"
      />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Como podemos ajudar?</span>
        <textarea
          name="reason"
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton pending={pending} pendingLabel="Enviando..." className="w-full">
        Enviar
      </SubmitButton>
      <p className="text-xs text-muted">
        Ao enviar, você concorda em ser contatado por esta empresa. Seus dados são usados apenas para esse atendimento.
      </p>
    </form>
  );
}
