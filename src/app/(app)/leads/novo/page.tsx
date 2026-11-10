import type { Metadata } from "next";
import { requireOrganization } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { LeadForm } from "../lead-form";

export const metadata: Metadata = { title: "Novo lead" };

export default async function NovoLeadPage({ searchParams }: PageProps<"/leads/novo">) {
  await requireOrganization();
  const { de } = await searchParams;
  return (
    <>
      <PageHeader title="Novo lead" />
      <Card className="p-5">
        <LeadForm back={de === "funil" ? "funil" : "leads"} />
      </Card>
    </>
  );
}
