import { formatClock, parseJson } from "@/lib/utils";

export const OBSERVABILITY_VS_SECURITY = `Security tells you:

"Should this action be allowed?"

Observability tells you:

"What is the AI system actually doing?"`;

export const OBSERVABILITY_CHAIN_ASCII = `User
 ↓
Orchestrator
 ↓
Architect Agent
 ↓
Developer Agent
 ↓
QA Agent
 ↓
Security Agent
 ↓
Deployment Agent`;

export const OBSERVABILITY_TREE_ASCII = `Workflow
│
├── Agent execution
│     ├── Input
│     ├── Context
│     ├── Model
│     ├── Prompt
│     ├── Output
│     ├── Tokens
│     ├── Cost
│     └── Duration
│
├── Tool execution
│     ├── Tool
│     ├── Arguments
│     ├── Result
│     ├── Risk
│     └── Decision
│
└── Final result`;

export const OBSERVABILITY_EXAMPLE_LOG = `Workflow: Fix Production Bug #182

10:32:01 Orchestrator started
10:32:03 Architect Agent started
10:32:15 GitHub.read_file
10:32:17 Architect completed

10:32:18 Developer Agent started
10:32:22 GitHub.read_file
10:32:31 GitHub.create_branch
10:32:45 GitHub.modify_file

10:32:46 Security Gateway
          → Risk: MEDIUM
          → ALLOWED

10:33:01 QA Agent started
10:33:40 Tests FAILED

10:33:41 Developer Agent retry`;

export const OBSERVABILITY_QUESTIONS = [
  "Which agent failed?",
  "What did it do?",
  "Which tools did it call?",
  "What did the LLM receive?",
  "What did it output?",
  "How much did it cost?",
  "How long did it take?",
  "Why did it make that decision?",
] as const;

const TOOL_NS: Record<string, string> = {
  github: "GitHub",
  ci: "CI",
  observability: "Observability",
  deploy: "Deploy",
  rollback: "Rollback",
  artifact: "Artifact",
  web: "Web",
  memory: "Memory",
  mcp: "MCP",
  secrets: "Secrets",
  shell: "Shell",
  db: "DB",
  config: "Config",
  external_api: "External_api",
};

export function displayToolName(name: string) {
  const [ns, ...rest] = name.split(".");
  if (!ns) return name;
  const pretty = TOOL_NS[ns] || ns.charAt(0).toUpperCase() + ns.slice(1);
  return rest.length ? `${pretty}.${rest.join(".")}` : pretty;
}

export function verdictLabel(verdict: string) {
  if (verdict === "allow" || verdict === "allowed") return "ALLOWED";
  if (verdict === "deny" || verdict === "denied") return "BLOCKED";
  if (verdict === "human" || verdict === "awaiting_gateway") return "HUMAN APPROVAL";
  return verdict.replace(/_/g, " ").toUpperCase();
}

export function riskWord(score: number) {
  if (score >= 70) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function isQuietTool(name: string) {
  return name === "artifact.write";
}

function isReadTool(name: string) {
  return /read_file|search_code|get_diff|get_logs|get_metrics|inspect|artifact\.write|ci\.run_/.test(
    name,
  );
}

export type DebugLine = {
  at: Date;
  seq: number;
  clock: string;
  kind: "orchestrator" | "agent" | "tool" | "gateway" | "qa" | "result";
  title: string;
  details?: string[];
};

export type DebugTimeline = {
  heading: string;
  lines: DebugLine[];
};

type TimelineInput = {
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt?: Date;
  status: string;
  task: { title: string };
  workflow: { name: string };
  steps: Array<{
    name: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    output: string | null;
    agent: { name: string; slug: string; role?: string };
    gatewayEvents: Array<{
      toolName: string;
      toolAction: string;
      verdict: string;
      riskScore: number;
      createdAt: Date;
      arguments?: string | null;
    }>;
  }>;
};

export function buildDebugTimeline(execution: TimelineInput): DebugTimeline {
  const lines: DebugLine[] = [];
  const origin = execution.startedAt || execution.createdAt || new Date();
  let developerStarts = 0;

  const push = (
    at: Date | null | undefined,
    seq: number,
    kind: DebugLine["kind"],
    title: string,
    details?: string[],
  ) => {
    const when = at || origin;
    lines.push({
      at: when,
      seq,
      clock: formatClock(when),
      kind,
      title,
      details,
    });
  };

  push(origin, 0, "orchestrator", "Orchestrator started");

  execution.steps.forEach((step, index) => {
    if (step.status === "pending" && !step.startedAt && !(step.gatewayEvents || []).length) {
      return;
    }
    const base = (index + 1) * 100;
    const start = step.startedAt || origin;
    const slug = step.agent.slug;
    const role = step.agent.role || slug;
    let startTitle = `${step.agent.name} started`;
    if (slug === "developer") {
      developerStarts += 1;
      startTitle =
        developerStarts > 1 ? "Developer Agent retry" : "Developer Agent started";
    }
    push(start, base, "agent", startTitle);

    const seenTools = new Set<string>();
    const tools = (step.gatewayEvents || []).filter((event) => {
      if (isQuietTool(event.toolName)) return false;
      const key = `${event.toolName}:${event.toolAction}`;
      if (seenTools.has(key)) return false;
      seenTools.add(key);
      return true;
    });
    tools.forEach((event, toolIndex) => {
      push(event.createdAt, base + 10 + toolIndex, "tool", displayToolName(event.toolName));
      if (!isReadTool(event.toolName) || event.verdict !== "allow") {
        push(event.createdAt, base + 40 + toolIndex, "gateway", "Security Gateway", [
          `Risk: ${riskWord(event.riskScore)}`,
          verdictLabel(event.verdict),
        ]);
      }
    });

    const failed =
      step.status === "failed" ||
      /\b(tests? failed|failed|no-go)\b/i.test(step.output || "");
    if ((role === "qa" || slug === "qa") && failed) {
      push(step.completedAt || start, base + 80, "qa", "Tests FAILED");
    }

    if (step.status === "completed" || step.completedAt) {
      push(
        step.completedAt || start,
        base + 90,
        "agent",
        `${step.agent.name.replace(/^AI /, "")} completed`,
      );
    } else if (step.status === "awaiting_approval" || step.status === "awaiting_gateway") {
      push(step.completedAt || start, base + 90, "agent", `${step.agent.name} waiting`);
    }
  });

  if (execution.completedAt || ["completed", "failed", "denied"].includes(execution.status)) {
    push(
      execution.completedAt || origin,
      100000,
      "result",
      `Final result · ${execution.status.replace(/_/g, " ")}`,
    );
  }

  lines.sort((a, b) => a.at.getTime() - b.at.getTime() || a.seq - b.seq);
  return {
    heading: `Workflow: ${execution.task.title}`,
    lines,
  };
}

export function toolDecisionFromGateway(event: {
  toolName: string;
  arguments: string | null;
  verdict: string;
  riskScore: number;
}) {
  return {
    tool: displayToolName(event.toolName),
    arguments: JSON.stringify(parseJson<Record<string, unknown>>(event.arguments, {})),
    result: event.verdict,
    risk: `${riskWord(event.riskScore)} (${event.riskScore})`,
    decision: verdictLabel(event.verdict),
  };
}
