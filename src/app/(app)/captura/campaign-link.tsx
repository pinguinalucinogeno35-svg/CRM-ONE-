"use client";

import { useState } from "react";
import { CopyField } from "@/components/copy-field";
import { CAMPAIGN_PATTERN, SOURCES } from "@/lib/leads";

const control = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm";

/** Monta um link do formulário público marcado com origem e campanha. */
export function CampaignLink({ baseLink }: { baseLink: string }) {
  const [source, setSource] = useState("instagram");
  const [campaign, setCampaign] = useState("");
  const name = campaign.trim();
  const valid = CAMPAIGN_PATTERN.test(name);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Onde o link será usado</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={control}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Nome da campanha</span>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            maxLength={60}
            placeholder="Ex.: Promo de Verão"
            className={`${control} placeholder:text-muted/70`}
          />
        </label>
      </div>
      {name && !valid ? (
        <p className="text-sm text-danger" role="alert">
          Use só letras, números, espaços e hífens.
        </p>
      ) : null}
      {valid ? (
        <CopyField label="Link desta campanha" value={`${baseLink}?origem=${source}&c=${encodeURIComponent(name)}`} />
      ) : null}
    </div>
  );
}
