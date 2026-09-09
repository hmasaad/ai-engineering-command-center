import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import {
  AGENT_STATE_ASCII,
  AGENT_STATE_EXAMPLE,
  AGENT_STATE_UNSAFE_ASCII,
  type CompactWorkflowState,
  type WorkflowStateDocument,
} from "@/lib/agent-state";
import { cx } from "@/lib/utils";

export function AgentStateAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Agent State
      </div>
      <pre className="font-mono text-[12px] leading-6 text-live sm:text-[13px] whitespace-pre">
        {AGENT_STATE_ASCII}
      </pre>
    </div>
  );
}

export function AgentStateUnsafeAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-danger/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,80,80,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Not this
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-danger sm:text-[13px] whitespace-pre">
        {AGENT_STATE_UNSAFE_ASCII}
      </pre>
      <p className="mt-3 text-center text-xs text-muted">
        Durable workflow state survives each agent execution. A chatbot that forgets when the turn ends cannot run an incident.
      </p>
    </div>
  );
}

export function AgentStateExampleJson() {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        For example
      </div>
      <pre className="overflow-x-auto rounded-lg border border-line bg-[#070d14] p-4 font-mono text-[12px] leading-6 text-live">
        {JSON.stringify(AGENT_STATE_EXAMPLE, null, 2)}
      </pre>
    </section>
  );
}

export function AgentStateTree({ document }: { document: WorkflowStateDocument }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Goal", value: document.goal },
    { label: "Plan", value: document.plan.join(" → ") || "—" },
    { label: "Tasks", value: `${document.tasks.length} in the workflow` },
    { label: "Current task", value: document.current_task || "—" },
    {
      label: "Agent states",
      value: document.agent_states
        .slice(0, 4)
        .map((row) => `${row.agent}: ${row.status}`)
        .join(" · ") || "—",
    },
    {
      label: "Tool results",
      value: document.tool_results
        .slice(0, 3)
        .map((row) => `${row.tool} ${row.verdict}`)
        .join(" · ") || "none yet",
    },
    {
      label: "Decisions",
      value: document.decisions.at(-1)?.summary || "none yet",
    },
    {
      label: "Errors",
      value: document.errors.length ? `${document.errors.length} recorded` : "none",
    },
    {
      label: "Approvals",
      value: document.approvals.length
        ? document.approvals.map((row) => row.status).join(" · ")
        : "none",
    },
    { label: "Final result", value: document.final_result || "not yet" },
  ];
  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.label}
          className="rounded-lg border border-line bg-background px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {row.label}
          </div>
          <p className="mt-1 text-sm">{row.value}</p>
        </li>
      ))}
    </ol>
  );
}

export function AgentStateLive({
  title,
  status,
  href,
  historyHref,
  compact,
}: {
  title: string;
  status: string;
  href: string;
  historyHref: string;
  compact: CompactWorkflowState;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live workflow state
          </div>
          <Link href={href} className="mt-1 block text-sm font-medium hover:text-live">
            {title}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <Link
            href={historyHref}
            className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-live"
          >
            History
          </Link>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-line bg-[#070d14] p-4 font-mono text-[12px] leading-6 text-live">
        {JSON.stringify(compact, null, 2)}
      </pre>
    </section>
  );
}

export function AgentStateNodes() {
  const nodes = [
    "Goal",
    "Plan",
    "Tasks",
    "Current",
    "Agents",
    "Tools",
    "Decisions",
    "Errors",
    "Approvals",
    "Result",
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {nodes.map((node) => (
        <span
          key={node}
          className={cx(
            "rounded-full border border-line bg-panel-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted",
          )}
        >
          {node}
        </span>
      ))}
    </div>
  );
}
