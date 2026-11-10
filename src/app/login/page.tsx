import type { Metadata } from "next";
import { LogoMark } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <LogoMark width={28} height={28} />
          <span className="text-lg font-semibold tracking-tight">CRM ONE</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Use o acesso enviado pela equipe ONE.</p>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Esqueceu a senha? Peça uma nova à equipe ONE.
        </p>
      </div>
    </main>
  );
}
