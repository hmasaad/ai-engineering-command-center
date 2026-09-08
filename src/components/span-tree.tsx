import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import type { ToolTrace } from "@/lib/observability";
import { formatDuration, formatUsd } from "@/lib/observability";
import { parseJson, truncate } from "@/lib/utils";

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
  agent: { name: string; role: string };
};

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
          <span className="text-muted">└── Result</span>
          <StatusBadge status={result} />
        </div>
      </div>
    </div>
  );
}

function AgentBranch({ span, expanded }: { span: SpanNode; expanded: boolean }) {
  const tools = parseJson<ToolTrace[]>(span.tools, []);
  const rows: Array<[string, string]> = [
    ["Input", truncate(span.input, expanded ? 1200 : 160)],
    ["Context", truncate(span.context, expanded ? 800 : 160)],
    ["Tools used", tools.length ? tools.map((tool) => tool.name).join(", ") : "none"],
    [
      "Tool arguments",
      tools.length
        ? tools
            .map((tool) => `${tool.name}.${tool.action} ${JSON.stringify(tool.arguments)}`)
            .join(" · ")
        : "{}",
    ],
    ["Output", span.output ? truncate(span.output, expanded ? 1600 : 180) : "—"],
    [
      "Tokens",
      `${span.tokenTotal.toLocaleString()} (in ${span.tokenInput.toLocaleString()} / out ${span.tokenOutput.toLocaleString()})`,
    ],
    ["Cost", formatUsd(span.costUsd)],
    ["Duration", formatDuration(span.durationMs)],
    ["Risk", String(span.riskScore)],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">├── Agent</span>
        <span>{span.agent.name}</span>
        <StatusBadge status={span.result} />
      </div>
      <div className="ml-4 mt-1 space-y-1 border-l border-line/70 pl-3 text-[11px] leading-5 text-muted">
        {rows.map(([label, value], index) => (
          <div key={label} className={expanded ? "whitespace-pre-wrap" : "truncate"}>
            <span className="text-foreground/70">
              {index === rows.length - 1 ? "└──" : "├──"} {label}
            </span>
            <span className="ml-2 text-muted">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
