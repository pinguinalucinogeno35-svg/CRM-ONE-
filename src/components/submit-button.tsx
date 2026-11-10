"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

const styles = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-bg",
  danger: "border border-line bg-surface text-danger hover:bg-danger-bg",
};

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  pending: pendingProp = false,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof styles;
  className?: string;
  /** Para formulários enviados com useFormAction, que não ativam o useFormStatus. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp || status.pending;
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
