import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import {
  AGENT_EVALS_ASCII,
  AGENT_EVALS_UNSAFE_ASCII,
  EVAL_SUITES,
  type EvalLiveCard,
  type EvalMetricScore,
  type EvalSuite,
} from "@/lib/agent-evals";
import { cx } from "@/lib/utils";

export function AgentEvalsAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Agent Evals
      </div>
      <pre className="font-mono text-[11px] leading-5 text-live sm:text-[12px] whitespace-pre">
        {AGENT_EVALS_ASCII}
      </pre>
    </div>
  );
}

export function AgentEvalsUnsafeAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-danger/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,80,80,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Not this
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-danger sm:text-[13px] whitespace-pre">
        {AGENT_EVALS_UNSAFE_ASCII}
      </pre>
      <p className="mt-3 text-center text-xs text-muted">
        A demo is not a score. Prompt, model, tool, and orchestration changes have to be measured.
      </p>
    </div>
  );
}

export function AgentEvalSuiteAscii({ suite }: { suite: EvalSuite }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {suite.label}
      </div>
      <pre className="font-mono text-[12px] leading-6 text-foreground sm:text-[13px] whitespace-pre">
        {suite.ascii}
      </pre>
      <p className="mt-3 text-xs text-muted">{suite.why}</p>
    </div>
  );
}

export function AgentEvalFeaturedSuites() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {EVAL_SUITES.filter((suite) => suite.id === "pr_reviewer" || suite.id === "incident").map(
        (suite) => (
          <Link key={suite.id} href={`/evals/${suite.id}`} className="block">
            <AgentEvalSuiteAscii suite={suite} />
          </Link>
        ),
      )}
    </div>
  );
}

function toneFor(score: number) {
  if (score >= 80) return "text-live";
  if (score >= 55) return "text-warn";
  return "text-danger";
}

export function AgentEvalMetrics({ metrics }: { metrics: EvalMetricScore[] }) {
  return (
    <ul className="space-y-2">
      {metrics.map((row) => (
        <li
          key={row.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-line bg-background px-3 py-2"
        >
          <span>
            <span className="text-sm">{row.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{row.evidence}</span>
          </span>
          <span className={cx("shrink-0 font-mono text-[11px]", toneFor(row.score))}>
            {row.score}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AgentEvalLive({
  card,
  compact = false,
}: {
  card: EvalLiveCard;
  compact?: boolean;
}) {
  const metrics = compact ? card.metrics.slice(0, 4) : card.metrics;
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live {card.label} eval
          </div>
          <Link href={card.href} className="mt-1 block text-sm font-medium hover:text-live">
            {card.agent} · {card.stepName}
          </Link>
          <p className="mt-1 text-xs text-muted">{card.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cx("font-mono text-sm", toneFor(card.overall))}>
            {card.overall}%
          </span>
          <StatusBadge status={card.verdict} />
        </div>
      </div>
      <AgentEvalMetrics metrics={metrics} />
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{card.sample} scored run{card.sample === 1 ? "" : "s"}</span>
        <Link href={card.historyHref} className="hover:text-live">
          History
        </Link>
      </div>
    </section>
  );
}

export function AgentEvalBoardRows({
  rows,
}: {
  rows: Array<{
    id: string;
    agent: string;
    role: string;
    suite: string;
    overall: number | null;
    verdict: string;
    stepName: string | null;
    href: string;
    sample: number;
  }>;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <h2 className="mb-3 text-sm font-medium">Every agent</h2>
      <p className="mb-4 text-xs text-muted">
        Each specialist has a suite. A prompt, model, tool, or orchestration change is scored on the next bound run.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Register agents, then run a workflow.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
              >
                <span>
                  {row.agent}
                  <span className="block text-xs text-muted">
                    {row.suite}
                    {row.stepName ? ` · ${row.stepName}` : " · no scored run yet"}
                    {row.sample ? ` · n=${row.sample}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {row.overall != null ? (
                    <span className={cx("font-mono text-[11px]", toneFor(row.overall))}>
                      {row.overall}%
                    </span>
                  ) : null}
                  <StatusBadge status={row.verdict} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
