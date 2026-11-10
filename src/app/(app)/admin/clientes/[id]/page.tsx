import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { IconBack } from "@/components/icons";
import { CopyField } from "@/components/copy-field";
import { siteUrl } from "@/lib/site-url";
import { removeChannel, removeClientUser, setOrganizationActive } from "../../actions";
import { NewUserForm, NewWhatsAppChannelForm, ResetPasswordForm } from "../../admin-forms";

export const metadata: Metadata = { title: "Cliente" };

type Member = { user_id: string; profiles: { email: string; full_name: string } };

export default async function ClientePage({ params }: PageProps<"/admin/clientes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: org }, { data: memberRows }, { data: channels }, base] = await Promise.all([
    supabase.from("organizations").select("id, name, is_active, capture_token").eq("id", id).maybeSingle(),
    supabase
      .from("memberships")
      .select("user_id, profiles!inner(email, full_name)")
      .eq("organization_id", id)
      .order("created_at"),
    supabase
      .from("capture_channels")
      .select("id, label, external_id")
      .eq("organization_id", id)
      .eq("kind", "whatsapp")
      .order("created_at"),
    siteUrl(),
  ]);
  if (!org) notFound();
  const members = (memberRows ?? []) as unknown as Member[];

  return (
    <>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconBack width={16} height={16} /> Clientes
      </Link>

      <PageHeader
        title={org.name}
        action={
          <div className="flex items-center gap-3">
            <Badge active={org.is_active}>{org.is_active ? "Ativo" : "Suspenso"}</Badge>
            <form action={setOrganizationActive}>
              <input type="hidden" name="organization_id" value={org.id} />
              <input type="hidden" name="active" value={String(!org.is_active)} />
              <SubmitButton variant={org.is_active ? "danger" : "secondary"} pendingLabel="Salvando...">
                {org.is_active ? "Suspender acesso" : "Reativar acesso"}
              </SubmitButton>
            </form>
          </div>
        }
      />

      <Card className="mb-4">
        <h2 className="border-b border-line px-5 py-4 font-semibold">Usuários</h2>
        {members.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Este cliente ainda não tem usuários.</p>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.profiles.full_name || m.profiles.email}</p>
                  <p className="truncate text-sm text-muted">{m.profiles.email}</p>
                </div>
                <ResetPasswordForm organizationId={org.id} userId={m.user_id} email={m.profiles.email} />
                <form action={removeClientUser}>
                  <input type="hidden" name="organization_id" value={org.id} />
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <SubmitButton variant="danger" pendingLabel="Removendo...">
                    Remover
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold">Novo usuário</h2>
        <NewUserForm organizationId={org.id} />
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="font-semibold">Captação de leads</h2>
        <CopyField label="Formulário público deste cliente" value={`${base}/f/${org.capture_token}`} />
        <div>
          <h3 className="mb-2 text-sm font-medium">Números de WhatsApp conectados</h3>
          {channels?.length ? (
            <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
              {channels.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate">{c.label || "Sem nome"}</p>
                    <p className="font-mono text-xs text-muted">ID {c.external_id}</p>
                  </div>
                  <form action={removeChannel}>
                    <input type="hidden" name="channel_id" value={c.id} />
                    <SubmitButton variant="danger" pendingLabel="Removendo...">
                      Remover
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted">Nenhum número conectado.</p>
          )}
          <NewWhatsAppChannelForm organizationId={org.id} />
        </div>
      </Card>
    </>
  );
}
