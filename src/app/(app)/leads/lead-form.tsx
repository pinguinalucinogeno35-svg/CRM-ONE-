"use client";

import Link from "next/link";
import { saveLead } from "./actions";
import { Alert, Field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/use-form-action";
import { SOURCES, STAGES, TEMPERATURES, formatPhone, type Lead } from "@/lib/leads";

const control = "w-full rounded-lg border border-line bg-surface px-3 text-sm";

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <select name={name} defaultValue={defaultValue} className={`${control} h-10`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LeadForm({ lead, back }: { lead?: Lead; back: "leads" | "funil" }) {
  const { state, pending, formProps } = useFormAction(saveLead);
  return (
    <form {...formProps} className="space-y-4">
      {lead ? <input type="hidden" name="id" value={lead.id} /> : null}
      <input type="hidden" name="back" value={back} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" defaultValue={lead?.name} required minLength={2} maxLength={120} autoComplete="off" />
        <Field
          label="Telefone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={lead ? formatPhone(lead.phone) : ""}
          required
          placeholder="(11) 91234-5678"
          hint="Com DDD."
          autoComplete="off"
        />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Motivo do contato</span>
        <textarea
          name="reason"
          defaultValue={lead?.reason}
          maxLength={500}
          rows={2}
          placeholder="Ex.: quer orçamento para clareamento dental"
          className={`${control} py-2 placeholder:text-muted/70`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Origem do contato" name="source" defaultValue={lead?.source ?? "instagram"} options={SOURCES} />
        <Select
          label="Temperatura"
          name="temperature"
          defaultValue={!lead || lead.temperature_mode === "auto" ? "auto" : lead.temperature}
          options={[{ value: "auto", label: "Automática" }, ...TEMPERATURES]}
        />
        <Select label="Etapa do funil" name="stage" defaultValue={lead?.stage ?? "novo"} options={STAGES} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Campanha ou anúncio"
          name="campaign"
          defaultValue={lead?.campaign}
          maxLength={120}
          autoComplete="off"
          hint="Opcional. Agrupa os resultados por campanha."
        />
        <Field
          label="Valor da venda (R$)"
          name="sale_value"
          inputMode="decimal"
          defaultValue={lead?.sale_value != null ? lead.sale_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
          placeholder="0,00"
          autoComplete="off"
          hint="Preencha ao fechar a venda."
        />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Observações</span>
        <textarea name="notes" defaultValue={lead?.notes} maxLength={2000} rows={3} className={`${control} py-2`} />
      </label>

      {state?.error ? <Alert>{state.error}</Alert> : null}

      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} pendingLabel="Salvando...">{lead ? "Salvar alterações" : "Criar lead"}</SubmitButton>
        <Link href={`/${back}`} className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-muted hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
