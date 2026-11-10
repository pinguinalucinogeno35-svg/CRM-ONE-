import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { IconChat } from "@/components/icons";
import { LEAD_COLUMNS, whatsappUrl, type Lead } from "@/lib/leads";
import { deleteLead } from "../actions";
import { LeadForm } from "../lead-form";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params, searchParams }: PageProps<"/leads/[id]">) {
  await requireOrganization();
  const [{ id }, { de }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const lead = data as Lead;

  return (
    <>
      <PageHeader
        title={lead.name}
        description={`Criado em ${new Date(lead.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
        action={
          <a
            href={whatsappUrl(lead.phone)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-bg"
          >
            <IconChat width={16} height={16} /> Abrir no WhatsApp
          </a>
        }
      />
      <Card className="mb-4 p-5">
        <LeadForm lead={lead} back={de === "funil" ? "funil" : "leads"} />
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Excluir lead</h2>
          <p className="text-sm text-muted">Remove o lead e o histórico dele. Não pode ser desfeito.</p>
        </div>
        <form action={deleteLead}>
          <input type="hidden" name="id" value={lead.id} />
          <SubmitButton variant="danger" pendingLabel="Excluindo...">
            Excluir
          </SubmitButton>
        </form>
      </Card>
    </>
  );
}
