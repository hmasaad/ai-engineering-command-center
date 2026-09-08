"use client";

import { useFormStatus } from "react-dom";
import { cx } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
  variant = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "ghost" | "danger" | "warn";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-live text-background hover:bg-live/90",
    ghost: "border border-line bg-panel hover:border-muted",
    danger: "bg-danger text-background hover:bg-danger/90",
    warn: "bg-warn text-background hover:bg-warn/90",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60",
        styles,
        className,
      )}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function RefreshButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex items-center rounded-lg border border-line bg-panel px-3 py-2 text-sm hover:border-muted"
    >
      Refresh
    </button>
  );
}
