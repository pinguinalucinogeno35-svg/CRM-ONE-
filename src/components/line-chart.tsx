"use client";

import { useId, useState } from "react";

export type ChartPoint = { day: string; value: number | null };

const W = 560;
const H = 190;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("pt-BR");
const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** Passo "redondo" (1, 2, 5 x 10^n) para cerca de três linhas de grade. */
function niceStep(range: number) {
  const raw = range / 3 || 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
}

/**
 * Gráfico de linha de uma série ao longo dos dias. `fromZero` ancora o eixo em
 * zero (volumes); sem ele o eixo acompanha a faixa dos dados (níveis, como seguidores).
 */
export function LineChart({ title, points, fromZero = true }: { title: string; points: ChartPoint[]; fromZero?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const clip = useId();
  const known = points.flatMap((p, i) => (p.value === null ? [] : [{ i, value: p.value, day: p.day }]));

  if (known.length < 2) {
    return (
      <div className="grid h-[190px] place-items-center rounded-xl bg-bg px-4 text-center text-sm text-muted">
        Ainda não há dias suficientes para o gráfico. Os dados se acumulam a cada atualização.
      </div>
    );
  }

  const values = known.map((k) => k.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const step = Math.max(1, niceStep(fromZero ? dataMax : dataMax - dataMin || dataMax));
  const min = fromZero ? 0 : Math.floor(dataMin / step) * step;
  const max = Math.max(min + step, Math.ceil(dataMax / step) * step);
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(t);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

  const line = known.map((k, n) => `${n === 0 ? "M" : "L"}${x(k.i).toFixed(1)},${y(k.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(known[known.length - 1].i).toFixed(1)},${y(min)} L${x(known[0].i).toFixed(1)},${y(min)} Z`;
  const format = max >= 10_000 ? (v: number) => compact.format(v) : (v: number) => full.format(v);
  const labelEvery = Math.ceil(points.length / 6);
  const active = hover === null ? null : known.reduce((best, k) => (Math.abs(k.i - hover) < Math.abs(best.i - hover) ? k : best));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none"
        role="img"
        aria-label={`${title}: de ${full.format(known[0].value)} em ${shortDay(known[0].day)} a ${full.format(known[known.length - 1].value)} em ${shortDay(known[known.length - 1].day)}`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          setHover(Math.round(((px - PAD.left) / innerW) * (points.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clip}>
            <rect x={PAD.left} y={0} width={innerW} height={H - PAD.bottom} />
          </clipPath>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {shortDay(p.day)}
            </text>
          ) : null,
        )}
        <g clipPath={`url(#${clip})`}>
          <path d={area} fill="var(--series)" opacity="0.1" />
          <path d={line} fill="none" stroke="var(--series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {active ? (
          <g>
            <line x1={x(active.i)} x2={x(active.i)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth="1" />
            <circle cx={x(active.i)} cy={y(active.value)} r="4.5" fill="var(--series)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        ) : null}
      </svg>
      {active ? (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${Math.min(88, Math.max(12, (x(active.i) / W) * 100))}%` }}
        >
          <span className="text-muted">{shortDay(active.day)}</span>{" "}
          <span className="font-semibold tabular-nums">{full.format(active.value)}</span>
        </div>
      ) : null}
      <details className="mt-1 text-xs text-muted">
        <summary className="cursor-pointer select-none py-1">Ver em tabela</summary>
        <table className="mt-1 w-full max-w-xs tabular-nums">
          <thead className="sr-only">
            <tr>
              <th>Dia</th>
              <th>{title}</th>
            </tr>
          </thead>
          <tbody>
            {known.map((k) => (
              <tr key={k.day} className="border-t border-line">
                <td className="py-1">{shortDay(k.day)}</td>
                <td className="py-1 text-right text-ink">{full.format(k.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
