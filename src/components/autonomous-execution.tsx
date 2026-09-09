import Link from "next/link";
import { HitlBandBadge } from "@/components/hitl";
import { cx } from "@/lib/utils";
import {
  AUTONOMY_CONTROLLED_ASCII,
  AUTONOMY_EXAMPLES,
  AUTONOMY_INITIAL_ASCII,
  AUTONOMY_UNSAFE_ASCII,
  autonomyLaneLabel,
  type AutonomyLane,
} from "@/lib/autonomous-execution";

export function AutonomyInitialAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Initially
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-foreground sm:text-[13px]">
        {AUTONOMY_INITIAL_ASCII}
      </pre>
    </div>
  );
}

export function AutonomyControlledAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Controlled autonomy
      </div>
      <pre className="text-center font-mono text-[11px] leading-5 text-live sm:text-[12px]">
        {AUTONOMY_CONTROLLED_ASCII}
      </pre>
    </div>
  );
}

export function AutonomyUnsafeAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-danger/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,80,80,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Not this
      </div>
      <pre className="text-center font-mono text-[13px] leading-6 text-danger sm:text-[14px]">
        {AUTONOMY_UNSAFE_ASCII}
      </pre>
      <p className="mt-3 text-center text-xs text-muted">
        Detect → investigate → plan → risk evaluation, then automatic / approval / mandatory. That is safer than unconstrained execution.
      </p>
    </div>
  );
}

export function AutonomyExampleCards() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {AUTONOMY_EXAMPLES.map((example) => {
        const tone =
          example.lane === "mandatory"
            ? "border-danger/40"
            : example.lane === "approval"
              ? "border-warn/40"
              : "border-live/40";
        const label =
          example.lane === "mandatory"
            ? "text-danger"
            : example.lane === "approval"
              ? "text-warn"
              : "text-live";
        return (
          <section key={example.tool} className={cx("rounded-xl border bg-panel/80 p-5", tone)}>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              {example.band} risk
            </div>
            <div className="mt-2 font-mono text-sm">{example.tool}</div>
            <div className={cx("mt-2 font-mono text-[11px] uppercase tracking-wider", label)}>
              {autonomyLaneLabel(example.lane)}
            </div>
            <p className="mt-2 text-xs text-muted">{example.why}</p>
          </section>
        );
      })}
    </div>
  );
}

type LedgerRow = {
  id: string;
  tool: string;
  agent: string;
  title: string;
  href: string;
  band: string;
  label: string;
};

export function AutonomyLedger({
  automatic,
  approval,
  mandatory,
  pending,
}: {
  automatic: LedgerRow[];
  approval: LedgerRow[];
  mandatory: LedgerRow[];
  pending: { approval: number; mandatory: number };
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <LaneColumn
        lane="automatic"
        title="Low → Automatic"
        empty="Reads, tests, and branches land here as they run."
        rows={automatic}
      />
      <LaneColumn
        lane="approval"
        title={`Medium → Approval${pending.approval ? ` · ${pending.approval} waiting` : ""}`}
        empty="Create PR and similar side effects wait for a review."
        rows={approval}
      />
      <LaneColumn
        lane="mandatory"
        title={`High → Mandatory${pending.mandatory ? ` · ${pending.mandatory} waiting` : ""}`}
        empty="Deploys, rollbacks, and database deletes never skip a human."
        rows={mandatory}
      />
    </div>
  );
}

function LaneColumn({
  lane,
  title,
  empty,
  rows,
}: {
  lane: AutonomyLane;
  title: string;
  empty: string;
  rows: LedgerRow[];
}) {
  const tone =
    lane === "mandatory" ? "border-danger/30" : lane === "approval" ? "border-warn/30" : "border-live/30";
  return (
    <section className={cx("rounded-xl border bg-panel/80 p-5", tone)}>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="block rounded-lg border border-line bg-background px-3 py-2 hover:border-live/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px]">{row.tool}</span>
                  <HitlBandBadge band={row.band} />
                </div>
                <div className="mt-1 truncate text-xs text-muted">
                  {row.agent} · {row.title}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
