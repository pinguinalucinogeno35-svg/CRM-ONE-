import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { LEAD_COLUMNS, type Lead } from "@/lib/leads";
import { Board } from "./board";

export const metadata: Metadata = { title: "Funil" };

const LIMIT = 500;

export default async function FunilPage() {
  await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(LIMIT);
  const leads = (data ?? []) as Lead[];

  return (
    <>
      <PageHeader
        title="Funil de vendas"
        description="Arraste um lead para mudar de etapa, ou abra o lead para editar."
        action={
          <Link
            href="/leads/novo?de=funil"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            <IconPlus width={16} height={16} /> Novo lead
          </Link>
        }
      />
      {error ? <Alert>Não foi possível carregar o funil.</Alert> : <Board leads={leads} />}
      {leads.length === LIMIT ? (
        <p className="mt-1 text-xs text-muted">Mostrando os {LIMIT} leads atualizados mais recentemente.</p>
      ) : null}
    </>
  );
}
