"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { moveLead } from "../leads/actions";
import { TemperatureBadge } from "@/components/lead-badges";
import { SOURCES, STAGES, formatPhone, labelOf, type Lead, type Stage } from "@/lib/leads";

type Move = { id: string; stage: Stage };

export function Board({ leads }: { leads: Lead[] }) {
  const [items, applyMove] = useOptimistic(leads, (state, move: Move) =>
    state.map((lead) => (lead.id === move.id ? { ...lead, stage: move.stage } : lead)),
  );
  const [, startTransition] = useTransition();
  const [over, setOver] = useState<Stage | null>(null);
  const [failed, setFailed] = useState(false);

  function onDrop(event: DragEvent, stage: Stage) {
    event.preventDefault();
    setOver(null);
    const id = event.dataTransfer.getData("text/plain");
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;

    setFailed(false);
    startTransition(async () => {
      applyMove({ id, stage });
      const ok = await moveLead(id, stage);
      if (!ok) setFailed(true);
    });
  }

  return (
    <>
      {failed ? (
        <p role="alert" className="mb-3 rounded-lg bg-danger-bg px-3 py-2.5 text-sm text-danger">
          Não foi possível mover o lead. Tente de novo.
        </p>
      ) : null}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {STAGES.map((stage) => {
          const column = items.filter((lead) => lead.stage === stage.value);
          return (
            <section
              key={stage.value}
              aria-label={stage.label}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== stage.value) setOver(stage.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(e) => onDrop(e, stage.value)}
              className={`flex w-64 shrink-0 flex-col rounded-2xl border p-2 transition md:w-0 md:min-w-44 md:flex-1 ${
                over === stage.value ? "border-ink bg-surface" : "border-line bg-line/40"
              }`}
            >
              <header className="flex items-center justify-between px-2 py-2">
                <h2 className="text-sm font-semibold">{stage.label}</h2>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
                  {column.length}
                </span>
              </header>
              <ul className="flex min-h-24 flex-1 flex-col gap-2">
                {column.map((lead) => (
                  <li
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab rounded-xl border border-line bg-surface p-3 active:cursor-grabbing"
                  >
                    <Link
                      href={`/leads/${lead.id}?de=funil`}
                      draggable={false}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">{formatPhone(lead.phone)}</p>
                    {lead.reason ? <p className="mt-1.5 line-clamp-2 text-xs text-muted">{lead.reason}</p> : null}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <TemperatureBadge value={lead.temperature} />
                      <span className="truncate text-xs text-muted">{labelOf(SOURCES, lead.source)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
