import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Alert, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Painel" };

const upcoming = [
  { title: "Leads", text: "Cadastro com nome, telefone, motivo e origem do contato." },
  { title: "Funil de vendas", text: "Leads organizados por etapa e por temperatura: quente, médio e frio." },
  { title: "Redes sociais", text: "Métricas dos seus perfis de Instagram e Facebook." },
];

export default async function PainelPage() {
  const ctx = await requireUser();
  if (ctx.isAdmin) redirect("/admin");

  if (!ctx.organization) {
    return (
      <>
        <PageHeader title="Painel" />
        <Alert kind="warn">
          Seu acesso não está vinculado a um cliente ativo. Fale com a equipe ONE para regularizar.
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={ctx.organization.name}
        description={`Olá${ctx.fullName ? `, ${ctx.fullName.split(" ")[0]}` : ""}. Este é o painel da sua empresa.`}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {upcoming.map((item) => (
          <Card key={item.title} className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Em breve</p>
            <h2 className="mt-2 font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted">{item.text}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
