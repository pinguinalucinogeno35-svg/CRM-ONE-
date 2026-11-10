import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { NameForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Conta" };

export default async function ContaPage() {
  const ctx = await requireUser();
  return (
    <>
      <PageHeader title="Conta" description={ctx.email} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Seus dados</h2>
          <NameForm fullName={ctx.fullName} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Senha</h2>
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}
