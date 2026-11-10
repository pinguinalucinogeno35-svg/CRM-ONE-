import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { STAGES, TEMPERATURES, type Stage, type Temperature } from "@/lib/leads";

export const metadata: Metadata = { title: "Painel" };

const temperatureTone: Record<Temperature, string> = {
  quente: "text-hot",
  medio: "text-warn",
  frio: "text-cold",
};

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

  const supabase = await createClient();
  const count = (column: "stage" | "temperature", value: string, openOnly = false) => {
    let query = supabase.from("leads").select("id", { count: "exact", head: true }).eq(column, value);
    if (openOnly) query = query.not("stage", "in", "(fechado,perdido)");
    return query.then((r) => r.count ?? 0);
  };
  const [byStage, byTemperature] = await Promise.all([
    Promise.all(STAGES.map((s) => count("stage", s.value))),
    Promise.all(TEMPERATURES.map((t) => count("temperature", t.value, true))),
  ]);
  const stageCount = Object.fromEntries(STAGES.map((s, i) => [s.value, byStage[i]])) as Record<Stage, number>;
  const total = byStage.reduce((a, b) => a + b, 0);
  const open = total - stageCount.fechado - stageCount.perdido;
  const maxStage = Math.max(1, ...byStage);

  return (
    <>
      <PageHeader
        title={ctx.organization.name}
        description={`Olá${ctx.fullName ? `, ${ctx.fullName.split(" ")[0]}` : ""}. Este é o resumo da sua empresa.`}
      />

      {total === 0 ? (
        <Card className="mb-4 p-8 text-center">
          <p className="font-medium">Nenhum lead ainda</p>
          <p className="mt-1 text-sm text-muted">Cadastre o primeiro contato para começar o funil.</p>
          <Link
            href="/leads/novo"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Novo lead
          </Link>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm text-muted">Leads em aberto</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{open}</p>
            </Card>
            {TEMPERATURES.map((t, i) => (
              <Link key={t.value} href={`/leads?temperatura=${t.value}`}>
                <Card className="p-5 transition hover:border-ink">
                  <p className="text-sm text-muted">{t.label}s em aberto</p>
                  <p className={`mt-1 text-3xl font-semibold tabular-nums ${temperatureTone[t.value]}`}>
                    {byTemperature[i]}
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          <Card className="mb-4 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Funil de vendas</h2>
              <Link href="/funil" className="text-sm font-medium text-muted hover:text-ink">
                Abrir funil
              </Link>
            </div>
            <ul className="space-y-2.5">
              {STAGES.map((s) => (
                <li key={s.value} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-line/70">
                    <span
                      className="block h-full rounded-full bg-ink"
                      style={{ width: `${(stageCount[s.value] / maxStage) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums">{stageCount[s.value]}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Link href="/redes">
        <Card className="p-5 transition hover:border-ink">
          <h2 className="font-semibold">Redes sociais</h2>
          <p className="mt-1 text-sm text-muted">Seguidores, alcance e melhores publicações do Instagram e do Facebook.</p>
        </Card>
      </Link>
    </>
  );
}
