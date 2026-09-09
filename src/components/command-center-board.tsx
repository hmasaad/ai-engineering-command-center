import Link from "next/link";
import {
  workflowBoardStatus,
  type ActionEvent,
} from "@/lib/action-event";
import { formatDuration, formatPct, formatUsd } from "@/lib/observability";

const RULE = "──────────────────────────────────";
const INNER = 34;

function pair(left: string, right: string) {
  const clipped = left.length > 22 ? `${left.slice(0, 21)}…` : left;
  const pad = Math.max(1, INNER - clipped.length - right.length);
  return `  ${clipped}${" ".repeat(pad)}${right}`;
}

function mark(status: string) {
  if (status === "completed") return "✓";
  if (status === "failed" || status === "denied") return "×";
  return "●";
}

export function CommandCenterBoard({
  workflows,
  agents,
  approvals,
  metrics,
}: {
  workflows: Array<{ id: string; name: string; status: string; href: string }>;
  agents: Array<{ name: string; status: string }>;
  approvals: Array<{ id: string; title: string; href: string }>;
  metrics: {
    successRate: number;
    avgDuration: number;
    agentCost: number;
    humanInterventions: number;
  };
}) {
  const workflowLines =
    workflows.length === 0
      ? ["  —                        None"]
      : workflows.map((row) =>
          pair(`${mark(row.status)} ${row.name}`, workflowBoardStatus(row.status)),
        );
  const agentLines =
    agents.length === 0
      ? ["  —                        Idle"]
      : agents.map((row) => pair(row.name, row.status));
  const approvalLines =
    approvals.length === 0
      ? ["  —                        Clear"]
      : approvals.map((row) => pair(`⚠ ${row.title}`, "Awaiting approval"));

  const box = [
    "Command Center",
    RULE,
    "",
    "WORKFLOWS",
    ...workflowLines,
    "",
    "AGENTS",
    ...agentLines,
    "",
    "APPROVALS",
    ...approvalLines,
    "",
    "METRICS",
    pair("Success rate", formatPct(metrics.successRate)),
    pair("Avg duration", formatDuration(metrics.avgDuration)),
    pair("Agent cost", formatUsd(metrics.agentCost)),
    pair("Human interventions", formatPct(metrics.humanInterventions)),
  ].join("\n");

  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <pre className="min-w-[22rem] font-mono text-[13px] leading-7 text-live">{box}</pre>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <BoardLinks title="Workflows" items={workflows.map((row) => ({ href: row.href, label: row.name }))} />
        <BoardLinks
          title="Approvals"
          items={approvals.map((row) => ({ href: row.href, label: row.title }))}
          emptyHref="/approvals"
        />
        <BoardLinks
          title="Traces"
          items={workflows.slice(0, 3).map((row) => ({
            href: `/observability/${row.id}`,
            label: row.name,
          }))}
          emptyHref="/observability"
        />
      </div>
    </div>
  );
}

function BoardLinks({
  title,
  items,
  emptyHref,
}: {
  title: string;
  items: Array<{ href: string; label: string }>;
  emptyHref?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{title}</div>
      {items.length === 0 ? (
        emptyHref ? (
          <Link href={emptyHref} className="mt-1 block text-xs text-muted hover:text-live">
            Open
          </Link>
        ) : (
          <p className="mt-1 text-xs text-muted">None</p>
        )
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li key={item.href + item.label}>
              <Link href={item.href} className="text-xs text-muted hover:text-live">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActionEventJson({ event }: { event: ActionEvent }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-[#070d14] p-3 font-mono text-[11px] leading-5 text-live">
      {JSON.stringify(event, null, 2)}
    </pre>
  );
}
