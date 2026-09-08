import Link from "next/link";
import { cx } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";

const styles: Record<string, string> = {
  active: "bg-live/15 text-live",
  running: "bg-live/15 text-live",
  completed: "bg-live/15 text-live",
  approved: "bg-live/15 text-live",
  awaiting_approval: "bg-warn/15 text-warn",
  pending: "bg-warn/15 text-warn",
  in_progress: "bg-info/15 text-info",
  open: "bg-info/15 text-info",
  failed: "bg-danger/15 text-danger",
  rejected: "bg-danger/15 text-danger",
  denied: "bg-danger/15 text-danger",
  awaiting_gateway: "bg-warn/15 text-warn",
  allowed: "bg-live/15 text-live",
  cancelled: "bg-muted/15 text-muted",
  inactive: "bg-muted/15 text-muted",
  disabled: "bg-muted/15 text-muted",
  skipped: "bg-muted/15 text-muted",
  critical: "bg-danger/15 text-danger",
  high: "bg-warn/15 text-warn",
  medium: "bg-info/15 text-info",
  low: "bg-muted/15 text-muted",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        styles[status] || "bg-muted/15 text-muted",
        className,
      )}
    >
      {STATUS_LABELS[status] || status.replaceAll("_", " ")}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  href,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  accent?: "live" | "warn" | "info" | "muted";
}) {
  const color =
    accent === "warn"
      ? "text-warn"
      : accent === "info"
        ? "text-info"
        : accent === "muted"
          ? "text-muted"
          : "text-live";
  const inner = (
    <div className="rounded-xl border border-line bg-panel/80 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className={cx("mt-2 text-3xl font-semibold tabular-nums", color)}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="block transition hover:border-live/40">
      {inner}
    </Link>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-panel/40 px-6 py-10 text-center">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker ? (
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-live">
            {kicker}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg bg-live px-3 py-2 text-sm font-medium text-background hover:bg-live/90"
    >
      {children}
    </Link>
  );
}

export function GhostLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-line bg-panel px-3 py-2 text-sm text-foreground hover:border-muted"
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none ring-live/40 placeholder:text-muted/70 focus:border-live focus:ring-2";
