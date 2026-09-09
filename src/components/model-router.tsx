import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import {
  MODEL_LANES,
  MODEL_ROUTER_ASCII,
  MODEL_ROUTER_UNSAFE_ASCII,
  MODEL_ROUTE_EXAMPLES,
  type ModelLane,
  type ModelRouteLedger,
} from "@/lib/model-router";
import { cx } from "@/lib/utils";

const LANE_TONE: Record<ModelLane, string> = {
  fast: "text-live",
  reasoning: "text-warn",
  specialized: "text-danger",
};

export function ModelRouterAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Model Router
      </div>
      <pre className="font-mono text-[11px] leading-5 text-live sm:text-[12px] whitespace-pre">
        {MODEL_ROUTER_ASCII}
      </pre>
    </div>
  );
}

export function ModelRouterUnsafeAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-danger/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,80,80,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Not this
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-danger sm:text-[13px] whitespace-pre">
        {MODEL_ROUTER_UNSAFE_ASCII}
      </pre>
      <p className="mt-3 text-center text-xs text-muted">
        Blindly calling the most expensive model wastes cost and latency on formatting and summaries.
      </p>
    </div>
  );
}

export function ModelRouterLanes() {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Three lanes
      </div>
      <p className="mb-4 text-sm text-muted">
        The runtime decides cost, latency, and quality per task — not per agent record.
      </p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {(Object.values(MODEL_LANES) as Array<(typeof MODEL_LANES)[ModelLane]>).map(
          (lane) => (
            <li
              key={lane.id}
              className="rounded-lg border border-line bg-background px-3 py-2"
            >
              <div className={cx("font-mono text-[11px]", LANE_TONE[lane.id])}>
                {lane.label}
              </div>
              <div className="mt-1 font-mono text-xs">{lane.model}</div>
              <p className="mt-1 text-xs text-muted">{lane.for}</p>
              <p className="mt-1 text-xs text-muted">{lane.why}</p>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

export function ModelRouterExamples() {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        For example
      </div>
      <ul className="space-y-2">
        {MODEL_ROUTE_EXAMPLES.map((example) => {
          const lane = MODEL_LANES[example.lane];
          return (
            <li
              key={example.task}
              className="flex items-start justify-between gap-3 rounded-lg border border-line bg-background px-3 py-2"
            >
              <span>
                <span className="text-sm">{example.task}</span>
                <span className="mt-0.5 block text-xs text-muted">{example.why}</span>
              </span>
              <span
                className={cx(
                  "shrink-0 font-mono text-[11px]",
                  LANE_TONE[example.lane],
                )}
              >
                {lane.model}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ModelRouterLive({ ledger }: { ledger: ModelRouteLedger }) {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live route ledger
          </div>
          <Link href={ledger.href} className="mt-1 block text-sm font-medium hover:text-live">
            {ledger.title}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={ledger.status} />
          <Link
            href={ledger.historyHref}
            className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-live"
          >
            History
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {(Object.keys(MODEL_LANES) as ModelLane[]).map((id) => (
          <div
            key={id}
            className="rounded-lg border border-line bg-background px-3 py-2"
          >
            <div className={cx("font-mono text-[10px] uppercase tracking-wider", LANE_TONE[id])}>
              {MODEL_LANES[id].label}
            </div>
            <div className="mt-1 font-mono text-xs">
              {ledger.counts[id]} step{ledger.counts[id] === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>

      <ol className="space-y-2">
        {ledger.rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="flex items-start justify-between gap-3 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
            >
              <span>
                {row.agent} · {row.stepName}
                <span className="mt-0.5 block text-xs text-muted">{row.reason}</span>
              </span>
              <span className={cx("shrink-0 font-mono text-[11px]", LANE_TONE[row.lane])}>
                {row.model}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ModelRouterCompact({ ledger }: { ledger: ModelRouteLedger }) {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live routes
          </div>
          <Link href={ledger.href} className="mt-1 block text-sm font-medium hover:text-live">
            {ledger.title}
          </Link>
        </div>
        <StatusBadge status={ledger.status} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(MODEL_LANES) as ModelLane[]).map((id) => (
          <div
            key={id}
            className="rounded-lg border border-line bg-background px-3 py-2"
          >
            <div className={cx("font-mono text-[10px] uppercase tracking-wider", LANE_TONE[id])}>
              {MODEL_LANES[id].label}
            </div>
            <div className="mt-1 font-mono text-xs">
              {ledger.counts[id]} · {MODEL_LANES[id].model}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {ledger.rows.slice(0, 6).map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-2 font-mono text-[11px]"
          >
            <span className="truncate text-muted">{row.stepName}</span>
            <span className={LANE_TONE[row.lane]}>{row.model}</span>
          </li>
        ))}
      </ul>
      <Link href="/routing" className="mt-3 block text-xs text-muted hover:text-live">
        Open Model Routing
      </Link>
    </section>
  );
}
