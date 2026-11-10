"use client";

import { useState } from "react";
import { IconCopy, IconDone } from "./icons";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem acesso à área de transferência: o campo continua selecionável.
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-xs"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-bg"
        >
          {copied ? <IconDone width={16} height={16} /> : <IconCopy width={16} height={16} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
