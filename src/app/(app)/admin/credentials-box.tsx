"use client";

import { useState } from "react";
import { IconCopy, IconDone } from "@/components/icons";
import type { Credentials } from "@/lib/action-state";

export function CredentialsBox({ credentials }: { credentials: Credentials }) {
  const [copied, setCopied] = useState(false);
  const text = `E-mail: ${credentials.email}\nSenha provisória: ${credentials.password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem acesso à área de transferência: os dados continuam visíveis para cópia manual.
    }
  }

  return (
    <div className="rounded-lg border border-line bg-bg p-3 text-sm" role="status">
      <p className="mb-2 font-medium">Envie estes dados ao usuário. A senha não será exibida de novo.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
        <dt className="text-muted">E-mail</dt>
        <dd className="break-all">{credentials.email}</dd>
        <dt className="text-muted">Senha</dt>
        <dd className="break-all">{credentials.password}</dd>
      </dl>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium hover:bg-bg"
      >
        {copied ? <IconDone width={14} height={14} /> : <IconCopy width={14} height={14} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
