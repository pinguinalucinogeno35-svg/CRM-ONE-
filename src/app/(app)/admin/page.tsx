import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { IconChevron } from "@/components/icons";
import { NewOrganizationForm } from "./admin-forms";

export const metadata: Metadata = { title: "Clientes" };

type Row = { id: string; name: string; is_active: boolean; memberships: { count: number }[] };

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, is_active, memberships(count)")
    .order("name");
  const organizations = (data ?? []) as Row[];

  return (
    <>
      <PageHeader title="Clientes" description="Empresas que usam o CRM ONE." />

      <Card className="mb-4 p-5">
        <NewOrganizationForm />
      </Card>

      {error ? <Alert>Não foi possível carregar os clientes.</Alert> : null}

      {!error && organizations.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium">Nenhum cliente ainda</p>
          <p className="mt-1 text-sm text-muted">Crie o primeiro cliente no campo acima.</p>
        </Card>
      ) : null}

      {organizations.length > 0 ? (
        <Card>
          <ul className="divide-y divide-line">
            {organizations.map((org) => {
              const users = org.memberships[0]?.count ?? 0;
              return (
                <li key={org.id}>
                  <Link
                    href={`/admin/clientes/${org.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{org.name}</p>
                      <p className="text-sm text-muted">
                        {users} {users === 1 ? "usuário" : "usuários"}
                      </p>
                    </div>
                    <Badge active={org.is_active}>{org.is_active ? "Ativo" : "Suspenso"}</Badge>
                    <IconChevron className="text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
