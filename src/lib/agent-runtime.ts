import { db } from "@/lib/db";
import { displayToolName } from "@/lib/debug-log";
import {
  AGENT_MAX_ATTEMPTS,
  AGENT_TIMEOUT_MS,
} from "@/lib/orchestrator/runtime";
import { formatUsd } from "@/lib/observability";
import { parseRoutedModel, routeModel } from "@/lib/model-router";
import { toAgentRecord } from "@/lib/registry";
import { truncate } from "@/lib/utils";

export const AGENT_RUNTIME_ASCII = `                 AI ENGINEERING COMMAND CENTER
                            │
                            ↓
                     ORCHESTRATOR
                            │
                            ↓
                    ┌───────────────┐
                    │ AGENT RUNTIME │
                    └───────┬───────┘
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
          Context         Tools          Memory
             │              │              │
             └──────────────┼──────────────┘
                            ↓
                    Security Gateway
                            ↓
                      Tool Execution
                            ↓
                     Observability`;

export const AGENT_RUNTIME_WALK_ASCII = `Developer Agent
      │
      ↓
Agent Runtime
      │
      ├── Load agent configuration
      ├── Load task context
      ├── Retrieve relevant memory
      ├── Select model
      ├── Give available tools
      ├── Execute agent
      ├── Intercept tool calls
      │
      └── Send tool calls → Security Gateway
                              │
                              ↓
                         Tool execution
                              │
                              ↓
                         Return result
                              │
                              ↓
                         Agent continues`;

export const AGENT_RUNTIME_DUTIES = [
  { id: "identity", label: "Agent identity", why: "Bound specialist from the registry. Role is not invented in the prompt." },
  { id: "instructions", label: "System instructions", why: "The charter on the registry record. Runtime loads it; the operator does not paste it each run." },
  { id: "context", label: "Context", why: "Project, task, focus, and operator instruction for this step." },
  { id: "state", label: "Conversation / task state", why: "Upstream specialist output in this workflow, not a fresh chat each time." },
  { id: "model", label: "Model selection", why: "The Model Router picks fast, reasoning, or specialized from the task. The registry default is not used blindly." },
  { id: "tools", label: "Tool access", why: "Declared tools only. Undeclared GitHub, deploy, or shell never appear." },
  { id: "calls", label: "Tool calls", why: "The specialist asks. The runtime intercepts. It never calls GitHub itself." },
  { id: "retries", label: "Retries", why: `Up to ${AGENT_MAX_ATTEMPTS} attempts when the bound agent throws or times out.` },
  { id: "timeouts", label: "Timeouts", why: `${AGENT_TIMEOUT_MS / 1000}s budget per attempt so a hung specialist cannot stall the workflow.` },
  { id: "errors", label: "Error handling", why: "A failed bound run marks the step failed. The orchestrator does not keep scheduling as if it succeeded." },
  { id: "tokens", label: "Token / cost tracking", why: "Input, output, tokens, and cost land on the span the flight recorder already owns." },
  { id: "security", label: "Security checks", why: "Every intercepted tool call still hits the Security Gateway before execution." },
  { id: "status", label: "Execution state", why: "running, awaiting gateway, completed, denied, or failed — one state per bound run." },
  { id: "result", label: "Final result", why: "The artifact, or the gateway hold, is the only thing the orchestrator sees next." },
] as const;

export const AGENT_RUNTIME_WALK = [
  { id: "config", label: "Load agent configuration", href: "/agents" },
  { id: "context", label: "Load task context", href: "/tasks" },
  { id: "memory", label: "Retrieve relevant memory", href: "/runtime" },
  { id: "model", label: "Select model", href: "/routing" },
  { id: "tools", label: "Give available tools", href: "/security/tools" },
  { id: "execute", label: "Execute agent", href: "/history" },
  { id: "intercept", label: "Intercept tool calls", href: "/security/gateway" },
  { id: "gateway", label: "Send tool calls → Security Gateway", href: "/security/gateway" },
  { id: "tool", label: "Tool execution", href: "/security/tools" },
  { id: "return", label: "Return result", href: "/observability" },
  { id: "continue", label: "Agent continues", href: "/observability" },
] as const;

export type RuntimeLivePhase = {
  id: string;
  label: string;
  href: string;
  status: "done" | "active" | "pending";
  detail: string;
};

export type RuntimeLiveSession = {
  agent: string;
  slug: string;
  role: string;
  stepName: string;
  model: string;
  systemPrompt: string;
  project: string;
  task: string;
  status: string;
  tools: string[];
  memory: string[];
  calls: Array<{ tool: string; verdict: string; risk: number }>;
  retries: number;
  timeoutMs: number;
  tokens: number;
  cost: string;
  durationMs: number;
  result: string | null;
  href: string;
  historyHref: string;
  phases: RuntimeLivePhase[];
};

function phaseStatus(
  done: boolean,
  active: boolean,
): RuntimeLivePhase["status"] {
  if (done) return "done";
  if (active) return "active";
  return "pending";
}

export async function getRuntimeLive(): Promise<RuntimeLiveSession | null> {
  const step =
    (await db.executionStep.findFirst({
      where: { agent: { role: "developer" }, startedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      include: {
        agent: true,
        span: true,
        gatewayEvents: { orderBy: { createdAt: "asc" } },
        execution: {
          include: {
            task: true,
            project: true,
            events: {
              where: { type: { in: ["agent_retry", "agent_failed"] } },
              orderBy: { createdAt: "asc" },
            },
            steps: {
              where: { status: "completed" },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    })) ||
    (await db.executionStep.findFirst({
      where: { startedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      include: {
        agent: true,
        span: true,
        gatewayEvents: { orderBy: { createdAt: "asc" } },
        execution: {
          include: {
            task: true,
            project: true,
            events: {
              where: { type: { in: ["agent_retry", "agent_failed"] } },
              orderBy: { createdAt: "asc" },
            },
            steps: {
              where: { status: "completed" },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    }));

  if (!step) return null;

  const spec = toAgentRecord(step.agent);
  const routed =
    parseRoutedModel(step.span?.context) ||
    routeModel({
      role: spec.role,
      domain: spec.domain,
      stepName: step.name,
      taskTitle: step.execution.task.title,
    });
  const seenCalls = new Set<string>();
  const calls = step.gatewayEvents
    .filter((event) => {
      if (event.toolName === "artifact.write") return false;
      const key = `${event.toolName}:${event.toolAction}`;
      if (seenCalls.has(key)) return false;
      seenCalls.add(key);
      return true;
    })
    .map((event) => ({
      tool: displayToolName(event.toolName),
      verdict: event.verdict,
      risk: event.riskScore,
    }));
  const memory = step.execution.steps
    .filter((row) => row.id !== step.id && row.output)
    .slice(-3)
    .map((row) => `${row.name}: ${truncate((row.output || "").replace(/^# .+\n/, ""), 80)}`);
  const started = Boolean(step.startedAt);
  const intercepted = step.gatewayEvents.length > 0;
  const executed =
    Boolean(step.output) && !step.output?.startsWith("# Agent Security Gateway");
  const running = ["running", "awaiting_gateway", "awaiting_approval"].includes(
    step.status,
  );

  const phases: RuntimeLivePhase[] = [
    {
      id: "config",
      label: "Load agent configuration",
      href: `/agents/${step.agent.id}`,
      status: "done",
      detail: `${spec.name} · ${spec.riskLevel}`,
    },
    {
      id: "context",
      label: "Load task context",
      href: `/tasks/${step.execution.task.id}`,
      status: "done",
      detail: step.execution.task.title,
    },
    {
      id: "memory",
      label: "Retrieve relevant memory",
      href: `/observability/${step.executionId}`,
      status: memory.length > 0 ? "done" : started ? "done" : "pending",
      detail: memory.length
        ? `${memory.length} upstream artifact${memory.length === 1 ? "" : "s"}`
        : "No upstream output yet",
    },
    {
      id: "model",
      label: "Select model",
      href: "/routing",
      status: "done",
      detail: `${routed.model} · ${routed.lane}`,
    },
    {
      id: "tools",
      label: "Give available tools",
      href: "/security/tools",
      status: spec.tools.length ? "done" : "pending",
      detail: spec.tools.slice(0, 3).join(", ") || "none declared",
    },
    {
      id: "execute",
      label: "Execute agent",
      href: `/history/${step.executionId}`,
      status: phaseStatus(executed, started && !executed && running),
      detail: step.name,
    },
    {
      id: "intercept",
      label: "Intercept tool calls",
      href: "/security/gateway",
      status: phaseStatus(intercepted, started && !intercepted),
      detail: intercepted
        ? `${step.gatewayEvents.length} intercept${step.gatewayEvents.length === 1 ? "" : "s"}`
        : "Waiting for a tool request",
    },
    {
      id: "gateway",
      label: "Send tool calls → Security Gateway",
      href: "/security/gateway",
      status: phaseStatus(intercepted, started && !intercepted),
      detail: intercepted
        ? step.gatewayEvents.map((event) => event.verdict).join(" · ")
        : "Not sent",
    },
    {
      id: "tool",
      label: "Tool execution",
      href: "/security/tools",
      status: phaseStatus(
        step.gatewayEvents.some((event) =>
          ["allow", "allowed", "approved"].includes(event.verdict) ||
          ["allowed", "approved"].includes(event.status),
        ),
        intercepted,
      ),
      detail: calls[0]?.tool || "Held until allow",
    },
    {
      id: "return",
      label: "Return result",
      href: `/observability/${step.executionId}`,
      status: phaseStatus(executed, running),
      detail: executed ? "Artifact returned to the runtime" : "No artifact yet",
    },
    {
      id: "continue",
      label: "Agent continues",
      href: `/observability/${step.executionId}`,
      status: phaseStatus(
        step.status === "completed",
        running || step.status === "failed" || step.status === "denied",
      ),
      detail:
        step.status === "completed"
          ? "Workflow advanced"
          : step.status.replaceAll("_", " "),
    },
  ];

  return {
    agent: spec.name,
    slug: spec.id,
    role: spec.role,
    stepName: step.name,
    model: routed.model,
    systemPrompt: truncate(spec.systemPrompt, 220),
    project: step.execution.project.name,
    task: step.execution.task.title,
    status: step.status,
    tools: spec.tools,
    memory,
    calls,
    retries: step.execution.events.filter((event) => event.type === "agent_retry")
      .length,
    timeoutMs: AGENT_TIMEOUT_MS,
    tokens: step.span?.tokenTotal || 0,
    cost: formatUsd(step.span?.costUsd || 0),
    durationMs: step.span?.durationMs || 0,
    result: step.output ? truncate(step.output.replace(/^# .+\n/, ""), 200) : null,
    href: `/observability/${step.executionId}`,
    historyHref: `/history/${step.executionId}`,
    phases,
  };
}

export async function getRuntimeSessions() {
  const steps = await db.executionStep.findMany({
    where: { startedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 8,
    include: {
      agent: true,
      span: true,
      _count: { select: { gatewayEvents: true } },
      execution: { include: { task: true, project: true } },
    },
  });

  return steps.map((step) => {
    const spec = toAgentRecord(step.agent);
    const routed =
      parseRoutedModel(step.span?.context) ||
      routeModel({
        role: spec.role,
        domain: spec.domain,
        stepName: step.name,
        taskTitle: step.execution.task.title,
      });
    return {
      id: step.id,
      agent: spec.name,
      stepName: step.name,
      model: routed.model,
      status: step.status,
      tools: spec.tools.length,
      intercepts: step._count.gatewayEvents,
      tokens: step.span?.tokenTotal || 0,
      href: `/observability/${step.executionId}`,
      title: step.execution.task.title,
      project: step.execution.project.name,
    };
  });
}
