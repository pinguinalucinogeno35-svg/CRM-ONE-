import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { isSource } from "@/lib/leads";
import { PublicForm } from "./public-form";

export const metadata: Metadata = { title: "Fale conosco", robots: { index: false } };

async function FormCard({ params, searchParams }: PageProps<"/f/[token]">) {
  await connection();
  const [{ token }, { origem }] = await Promise.all([params, searchParams]);
  const valid = /^[a-z0-9_]{8,64}$/i.test(token);
  const { data: name } = valid
    ? await createPublicClient().rpc("get_public_form", { p_token: token })
    : { data: null };

  if (typeof name !== "string") {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <h1 className="font-semibold">Formulário indisponível</h1>
        <p className="mt-1 text-sm text-muted">Este link não está mais ativo. Confira o endereço com a empresa.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Deixe seu contato e retornamos para você.</p>
      <PublicForm token={token} source={typeof origem === "string" && isSource(origem) ? origem : "site"} />
    </div>
  );
}

export default function PublicFormPage(props: PageProps<"/f/[token]">) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-line/70" aria-busy="true" />}>
          <FormCard {...props} />
        </Suspense>
      </div>
    </main>
  );
}
