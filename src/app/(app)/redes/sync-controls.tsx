"use client";

import { useEffect, useRef, useTransition } from "react";
import { syncSocialAccounts } from "./actions";

/**
 * Botão "Atualizar agora". Com `auto`, dispara sozinho uma vez ao abrir a
 * página (dados ausentes ou com mais de algumas horas).
 */
export function SyncControls({ auto, lastSynced }: { auto: boolean; lastSynced: string }) {
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  useEffect(() => {
    if (auto && !started.current) {
      started.current = true;
      startTransition(() => syncSocialAccounts());
    }
  }, [auto]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted" role="status">
        {pending ? "Buscando dados na Meta. Pode levar um minuto..." : lastSynced}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => syncSocialAccounts())}
        className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Atualizando..." : "Atualizar agora"}
      </button>
    </div>
  );
}
