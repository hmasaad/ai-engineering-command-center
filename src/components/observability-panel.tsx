import {
  formatDuration,
  formatPct,
  formatUsd,
} from "@/lib/observability";

const WIDTH = 44;

function line(left: string, right?: string) {
  const start = ` ${left}`;
  const end = right == null ? " " : `${right} `;
  const pad = Math.max(1, WIDTH - start.length - end.length);
  return `│${start}${" ".repeat(pad)}${end}│`;
}

function rule(kind: "top" | "mid" | "bottom") {
  const bar = "─".repeat(WIDTH);
  if (kind === "top") return `┌${bar}┐`;
  if (kind === "bottom") return `└${bar}┘`;
  return `├${bar}┤`;
}

export function ObservabilityPanel({
  kpis,
}: {
  kpis: {
    activeWorkflows: number;
    runningAgents: number;
    awaitingApproval: number;
    failedWorkflows: number;
    securityBlocks: number;
    agentSuccessRate: number;
    avgWorkflowDuration: number;
    agentCost: number;
    humanIntervention: number;
  };
}) {
  const box = [
    rule("top"),
    line("AI ENGINEERING COMMAND CENTER"),
    rule("mid"),
    line("Active Workflows", String(kpis.activeWorkflows)),
    line("Running Agents", String(kpis.runningAgents)),
    line("Awaiting Approval", String(kpis.awaitingApproval)),
    line("Failed Workflows", String(kpis.failedWorkflows)),
    line("Security Blocks", String(kpis.securityBlocks)),
    rule("mid"),
    line("Agent Success Rate", formatPct(kpis.agentSuccessRate)),
    line("Avg Workflow Duration", formatDuration(kpis.avgWorkflowDuration)),
    line("Agent Cost", formatUsd(kpis.agentCost)),
    line("Human Intervention", formatPct(kpis.humanIntervention)),
    rule("bottom"),
  ].join("\n");

  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <pre className="min-w-[28rem] font-mono text-[13px] leading-7 text-live">{box}</pre>
    </div>
  );
}
