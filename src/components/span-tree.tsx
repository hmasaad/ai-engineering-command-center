import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import {
  displayToolName,
  toolDecisionFromGateway,
  verdictLabel,
} from "@/lib/debug-log";
import type { ToolTrace } from "@/lib/observability";
import { formatDuration, formatUsd } from "@/lib/observability";
import { parseJson, truncate } from "@/lib/utils";

type GatewayTrace = {
  toolName: string;
  arguments: string | null;
  verdict: string;
  riskScore: number;
};

type SpanNode = {
  id: string;
  order: number;
  input: string;
  context: string;
  tools: string;
  output: string | null;
  tokenInput: number;
  tokenOutput: number;
  tokenTotal: number;
  costUsd: number;
  durationMs: number;
  riskScore: number;
  result: string;
  agent: {
    name: string;
    role: string;
    slug?: string;
    model?: string | null;
    systemPrompt?: string | null;
  };
  step?: { gatewayEvents?: GatewayTrace[] } | null;
};

function toolRows(span: SpanNode) {
  const events = span.step?.gatewayEvents?.filter((event) => event.toolName !== "artifact.write");
  if (events && events.length > 0) {
    const seen = new Set<string>();
    const unique: typeof events = [];
    for (const event of events) {
      const key = `${event.toolName}:${event.verdict}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(event);
    }
    return unique.map(toolDecisionFromGateway);
  }
  const tools = parseJson<ToolTrace[]>(span.tools, []).filter((tool) => tool.name !== "artifact.write");
  return tools.map((tool) => ({
    tool: displayToolName(tool.name),
    arguments: JSON.stringify(tool.arguments),
    result: "—",
    risk: String(span.riskScore),
    decision: "—",
  }));
}

export function SpanTree({
  workflowName,
  result,
  spans,
  expanded = false,
  href,
}: {
  workflowName: string;
  result: string;
  spans: SpanNode[];
  expanded?: boolean;
  href?: string;
}) {
  const headingClass = "flex items-center gap-2";
  return (
    <div className="font-mono text-xs">
      {href ? (
        <Link href={href} className={`${headingClass} hover:text-live`}>
          <span className="text-muted">Workflow</span>
          <span>{workflowName}</span>
          <StatusBadge status={result} />
        </Link>
      ) : (
        <div className={headingClass}>
          <span className="text-muted">Workflow</span>
          <span>{workflowName}</span>
          <StatusBadge status={result} />
        </div>
      )}
      <div className="mt-2 space-y-2 border-l border-line pl-4">
        {spans.map((span) => (
          <AgentBranch key={span.id} span={span} expanded={expanded} />
        ))}
        <div className="flex items-center gap-2">
          <span className="text-muted">└── Final result</span>
          <StatusBadge status={result} />
        </div>
      </div>
    </div>
  );
}

function AgentBranch({ span, expanded }: { span: SpanNode; expanded: boolean }) {
  const tools = toolRows(span);
  const rows: Array<[string, string]> = [
    ["Input", truncate(span.input, expanded ? 1200 : 160)],
    ["Context", truncate(span.context, expanded ? 800 : 160)],
    ["Model", span.agent.model || "command-center.v1"],
    ["Prompt", truncate(span.agent.systemPrompt || "—", expanded ? 800 : 140)],
    ["Output", span.output ? truncate(span.output, expanded ? 1600 : 180) : "—"],
    [
      "Tokens",
      `${span.tokenTotal.toLocaleString()} (in ${span.tokenInput.toLocaleString()} / out ${span.tokenOutput.toLocaleString()})`,
    ],
    ["Cost", formatUsd(span.costUsd)],
    ["Duration", formatDuration(span.durationMs)],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">├── Agent execution</span>
        <span>{span.agent.name}</span>
        <StatusBadge status={span.result} />
      </div>
      <div className="ml-4 mt-1 space-y-1 border-l border-line/70 pl-3 text-[11px] leading-5 text-muted">
        {rows.map(([label, value], index) => (
          <div key={label} className={expanded ? "whitespace-pre-wrap" : "truncate"}>
            <span className="text-foreground/70">
              {index === rows.length - 1 && tools.length === 0 ? "└──" : "├──"} {label}
            </span>
            <span className="ml-2 text-muted">{value}</span>
          </div>
        ))}
        {tools.length === 0 ? null : (
          <ToolBranch tools={tools} expanded={expanded} />
        )}
      </div>
    </div>
  );
}

function ToolBranch({
  tools,
  expanded,
}: {
  tools: ReturnType<typeof toolRows>;
  expanded: boolean;
}) {
  return (
    <div>
      <div className="text-foreground/70">└── Tool execution</div>
      <div className="ml-4 mt-1 space-y-2 border-l border-line/70 pl-3">
        {tools.map((tool, index) => {
          const fields: Array<[string, string]> = [
            ["Tool", tool.tool],
            ["Arguments", tool.arguments],
            ["Result", tool.result],
            ["Risk", tool.risk],
            ["Decision", tool.decision],
          ];
          return (
            <div key={`${tool.tool}-${index}`}>
              {fields.map(([label, value], fieldIndex) => (
                <div
                  key={label}
                  className={expanded ? "whitespace-pre-wrap break-all" : "truncate"}
                >
                  <span className="text-foreground/70">
                    {fieldIndex === fields.length - 1 ? "└──" : "├──"} {label}
                  </span>
                  <span
                    className={`ml-2 ${label === "Decision" && tool.decision !== "—" ? (tool.decision === "BLOCKED" ? "text-danger" : tool.decision === "HUMAN APPROVAL" ? "text-warn" : "text-live") : "text-muted"}`}
                  >
                    {verdictLabel(value) === value || label !== "Decision"
                      ? truncate(value, expanded ? 400 : 120)
                      : value}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
