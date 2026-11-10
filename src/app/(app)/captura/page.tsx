import type { Metadata } from "next";
import { requireOrganization } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { Card, PageHeader } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { CampaignLink } from "./campaign-link";

export const metadata: Metadata = { title: "Captação" };

export default async function CapturaPage() {
  const ctx = await requireOrganization();
  const supabase = await createClient();
  const [{ data: org }, { data: channels }, base] = await Promise.all([
    supabase.from("organizations").select("capture_token").eq("id", ctx.organization.id).single(),
    supabase.from("capture_channels").select("id, label, external_id").eq("kind", "whatsapp").order("created_at"),
    siteUrl(),
  ]);
  const link = `${base}/f/${org?.capture_token ?? ""}`;

  return (
    <>
      <PageHeader title="Captação" description="Canais que criam leads sozinhos, já com a origem preenchida." />

      <Card className="mb-4 space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Formulário público</h2>
          <p className="mt-1 text-sm text-muted">
            Quem preencher vira um lead na etapa Novo. Use o link de cada lugar para a origem sair certa.
          </p>
        </div>
        <CopyField label="Para a bio do Instagram" value={`${link}?origem=instagram`} />
        <CopyField label="Para o Facebook" value={`${link}?origem=facebook`} />
        <CopyField label="Para o site e outros lugares" value={link} />
      </Card>

      <Card className="mb-4 space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Link de campanha</h2>
          <p className="mt-1 text-sm text-muted">
            Use um link diferente em cada publicação ou anúncio. Em Resultados você vê quantos leads e vendas cada um
            trouxe.
          </p>
        </div>
        <CampaignLink baseLink={link} />
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">WhatsApp</h2>
        {channels?.length ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Toda pessoa que mandar mensagem para estes números vira um lead. Se ela veio de um anúncio, o anúncio
              aparece na origem.
            </p>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
              {channels.map((c) => (
                <li key={c.id} className="px-3 py-2.5 text-sm">
                  {c.label || "Número conectado"}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Nenhum número conectado. A equipe ONE faz a conexão do seu WhatsApp Business.
          </p>
        )}
      </Card>
    </>
  );
}
