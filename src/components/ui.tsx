import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        {...input}
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-muted/70"
      />
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const alertStyles = {
  error: "bg-danger-bg text-danger",
  success: "bg-positive-bg text-positive",
  warn: "bg-warn-bg text-warn",
};

export function Alert({
  kind = "error",
  children,
}: {
  kind?: keyof typeof alertStyles;
  children: ReactNode;
}) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2.5 text-sm ${alertStyles[kind]}`}>
      {children}
    </p>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Badge({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-positive-bg text-positive" : "bg-warn-bg text-warn"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="h-8 w-56 rounded-lg bg-line" />
      <div className="h-40 rounded-2xl bg-line/70" />
    </div>
  );
}
