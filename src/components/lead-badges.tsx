import { TEMPERATURES, labelOf, type Temperature } from "@/lib/leads";

const tone: Record<Temperature, string> = {
  quente: "bg-hot-bg text-hot",
  medio: "bg-warn-bg text-warn",
  frio: "bg-cold-bg text-cold",
};

export function TemperatureBadge({ value }: { value: Temperature }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone[value]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {labelOf(TEMPERATURES, value)}
    </span>
  );
}
