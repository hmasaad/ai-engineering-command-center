import type { Agent, Project, Task } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DANGEROUS_TOOLS,
  DEFAULT_PERMISSIONS,
  DEFAULT_POLICIES,
  TOOLS,
  scanMcpTool,
  scanUntrustedText,
  type DetectorHit,
  type PermissionMode,
  type ToolName,
} from "@/lib/security";

export type ProposedTool = {
  name: ToolName;
  action: string;
  arguments: Record<string, unknown>;
};

export type GatewayDecision = {
  phase: "preflight" | "postflight";
  tool: ProposedTool;
  riskScore: number;
  verdict: "allow" | "deny" | "human";
  reasons: string[];
  detectors: DetectorHit[];
  summary: string;
  permissionMode: PermissionMode;
};

const VERDICT_RANK = { allow: 0, human: 1, deny: 2 } as const;

export function proposeTools(input: {
  agent: Agent;
  action: string;
  instruction?: string | null;
  project: Project;
  task: Task;
}): ProposedTool[] {
  const text = `${input.task.title}\n${input.task.description}\n${input.instruction || ""}`;
  const tools: ProposedTool[] = [
    {
      name: "artifact.write",
      action: "emit",
      arguments: { task: input.task.title, agent: input.agent.slug },
    },
  ];

  if (input.project.githubUrl) {
    tools.push({
      name: "github.fetch",
      action: "read",
      arguments: {
        repo: `${input.project.githubOwner}/${input.project.githubRepo}`,
        focus: input.task.focusRef || null,
      },
    });
  }

  const role = input.agent.role;
  const action = input.action;

  if (
    (role === "developer" || role === "refactoring") &&
    (action === "implement" || action === "refactor")
  ) {
    tools.push({
      name: "repo.read",
      action: "read",
      arguments: { path: "linked-repo" },
    });
    tools.push({
      name: "github.patch",
      action: "propose",
      arguments: { title: input.task.title },
    });
  }

  if (role === "pr_reviewer" || role === "reviewer") {
    tools.push({
      name: "github.comment",
      action: "review",
      arguments: { focus: input.task.focusRef || null },
    });
  }

  if (role === "documentation" || role === "rag_poisoning" || /retriev|corpus|web\.fetch/i.test(text)) {
    tools.push({
      name: "web.fetch",
      action: "retrieve",
      arguments: { source: "untrusted-corpus" },
    });
  }

  if (/memory\.write|persist (this|the) (doc|context)/i.test(text)) {
    tools.push({
      name: "memory.write",
      action: "persist",
      arguments: { source: "retrieved" },
    });
  }

  if (role === "mcp_security" || /\bmcp\b|tools\/call/i.test(text)) {
    const method = /shell|exec|filesystem/i.test(text) ? "tools/call:shell.exec" : "tools/list";
    tools.push({
      name: "mcp.call",
      action: method,
      arguments: { server: "untrusted" },
    });
  }

  const analyzer = [
    "prompt_injection",
    "agent_hijacking",
    "rag_poisoning",
    "data_exfiltration",
    "mcp_security",
    "security_gateway",
    "tool_permissions",
    "security",
    "threat_response",
  ].includes(role);

  if (
    !analyzer &&
    /secrets\.read|process\.env|github_token|\.env/i.test(text)
  ) {
    tools.push({
      name: "secrets.read",
      action: "scan",
      arguments: { target: "environment" },
    });
  }

  if (!analyzer && /shell\.exec|rm\s+-rf|cat\s+\/etc/i.test(text)) {
    tools.push({
      name: "shell.exec",
      action: "run",
      arguments: { requested: true },
    });
  }

  if (
    ["monitoring", "log_analysis", "root_cause", "incident", "performance", "recovery"].includes(
      role,
    )
  ) {
    tools.push({
      name: "logs.read",
      action: "read",
      arguments: { window: "incident" },
    });
    tools.push({
      name: "metrics.read",
      action: "read",
      arguments: { slo: true },
    });
  }

  if (role === "deployment") {
    tools.push({
      name: "deploy.inspect",
      action: "inspect",
      arguments: { env: "production" },
    });
    if (action === "deploy") {
      tools.push({
        name: "deploy.apply",
        action: "apply",
        arguments: { env: "production" },
      });
    }
  }

  if (role === "rollback" || action === "rollback") {
    tools.push({
      name: "rollback.apply",
      action: "apply",
      arguments: { env: "production" },
    });
  }

  if (role === "build" || action === "build") {
    tools.push({
      name: "repo.read",
      action: "read",
      arguments: { path: "linked-repo" },
    });
    tools.push({
      name: "build.plan",
      action: "plan",
      arguments: { version: input.task.title },
    });
  }

  if (role === "release_risk") {
    tools.push({
      name: "deploy.inspect",
      action: "inspect",
      arguments: { env: "production" },
    });
    tools.push({
      name: "metrics.read",
      action: "read",
      arguments: { slo: true },
    });
  }

  const seen = new Set<string>();
  return tools.filter((tool) => {
    const key = `${tool.name}:${tool.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toolMeta(name: string) {
  return TOOLS.find((item) => item.name === name);
}

function permissionFor(
  permissions: Array<{ agentSlug: string; toolName: string; mode: string }>,
  agentSlug: string,
  toolName: string,
): PermissionMode {
  const specific = permissions.find(
    (row) => row.agentSlug === agentSlug && row.toolName === toolName,
  );
  const global = permissions.find(
    (row) => row.agentSlug === "*" && row.toolName === toolName,
  );
  const mode = (specific?.mode || global?.mode || "require_approval") as PermissionMode;
  return mode;
}

function isSecurityAnalyzer(agent: Agent) {
  return (
    agent.domain === "security" &&
    [
      "prompt_injection",
      "agent_hijacking",
      "rag_poisoning",
      "data_exfiltration",
      "mcp_security",
      "security_gateway",
      "tool_permissions",
      "security",
      "threat_response",
    ].includes(agent.role)
  );
}

function mergeHits(hits: DetectorHit[]): DetectorHit[] {
  const byKey = new Map<string, DetectorHit>();
  for (const hit of hits) {
    const key = `${hit.id}:${hit.detail}`;
    if (!byKey.has(key)) byKey.set(key, hit);
  }
  return [...byKey.values()];
}

export function evaluateToolRequest(input: {
  agent: Agent;
  task: Task;
  instruction?: string | null;
  phase: "preflight" | "postflight";
  tool: ProposedTool;
  text: string;
  policies: Array<{ detector: string; enabled: boolean; weight: number; name: string }>;
  permissions: Array<{ agentSlug: string; toolName: string; mode: string }>;
}): GatewayDecision {
  const enabled: Record<string, number> = {};
  const disabled = new Set<string>();
  for (const policy of input.policies) {
    if (policy.enabled) enabled[policy.detector] = policy.weight;
    else disabled.add(policy.detector);
  }
  const policyOn = (id: string) => {
    if (disabled.has(id)) return false;
    if (id in enabled) return true;
    return DEFAULT_POLICIES.some((policy) => policy.detector === id);
  };

  const hits: DetectorHit[] = [];
  if (policyOn("prompt_injection") || policyOn("agent_hijacking") || policyOn("rag_poisoning") || policyOn("data_exfiltration")) {
    hits.push(...scanUntrustedText(input.text, enabled));
  }
  if (policyOn("mcp_security")) {
    hits.push(
      ...scanMcpTool(
        input.tool.name,
        input.tool.action,
        input.text,
        enabled.mcp_security ?? 26,
      ),
    );
  }

  const permissionMode = permissionFor(input.permissions, input.agent.slug, input.tool.name);
  if (policyOn("tool_permission")) {
    if (permissionMode === "deny") {
      hits.push({
        id: "tool_permission",
        name: "Tool Permission Manager",
        score: enabled.tool_permission ?? 40,
        detail: `${input.tool.name} is denied for ${input.agent.slug === "security-gateway" ? "this agent" : input.agent.name}.`,
      });
    } else if (permissionMode === "require_approval") {
      hits.push({
        id: "tool_permission",
        name: "Tool Permission Manager",
        score: Math.round((enabled.tool_permission ?? 20) * 0.7),
        detail: `${input.tool.name} requires human approval (${input.agent.name}).`,
      });
    }
  }

  const unique = mergeHits(hits);
  const toolRisk = toolMeta(input.tool.name)?.risk ?? 12;
  const priorityBump =
    input.task.priority === "critical" ? 15 : input.task.priority === "high" ? 8 : 0;
  const detectorScore = unique.reduce((sum, hit) => sum + hit.score, 0);
  const riskScore = Math.min(100, 6 + toolRisk + priorityBump + Math.round(detectorScore * 0.45));

  const reasons = unique.map((hit) => `${hit.name}: ${hit.detail}`);
  const analyzer = isSecurityAnalyzer(input.agent);
  const dangerous = (DANGEROUS_TOOLS as string[]).includes(input.tool.name);
  const hostile = unique.some((hit) =>
    ["prompt_injection", "agent_hijacking", "rag_poisoning", "data_exfiltration"].includes(hit.id),
  );

  let verdict: GatewayDecision["verdict"] = "allow";
  if (permissionMode === "deny") {
    verdict = "deny";
    reasons.push(`Policy: ${input.tool.name} is denied.`);
  } else if (riskScore >= 88 && dangerous && !analyzer) {
    verdict = "deny";
    reasons.push("Risk score at deny threshold for a side-effecting tool.");
  } else if (
    permissionMode === "require_approval" ||
    (hostile && dangerous && !analyzer) ||
    (riskScore >= 42 && unique.length > 0)
  ) {
    verdict = "human";
    if (permissionMode === "require_approval") {
      reasons.push(`Policy: ${input.tool.name} requires a human before it runs.`);
    } else if (hostile && dangerous) {
      reasons.push("Hostile input combined with a side-effecting tool.");
    } else {
      reasons.push("Risk score requires a human gate.");
    }
  }

  if (analyzer && verdict === "deny" && permissionMode !== "deny") {
    verdict = "human";
    reasons.push("Security analyzer: deny downgraded to human so the detector can still report.");
  }

  if (analyzer && !dangerous && permissionMode === "allow") {
    verdict = "allow";
  }

  if (reasons.length === 0) {
    reasons.push("No detector hits. Tool is within the default allow list.");
  }

  const summary = `${verdict.toUpperCase()} · ${input.tool.name} · risk ${riskScore} · ${input.agent.name} (${input.phase})`;

  return {
    phase: input.phase,
    tool: input.tool,
    riskScore,
    verdict,
    reasons,
    detectors: unique,
    summary,
    permissionMode,
  };
}

export function strictest(decisions: GatewayDecision[]): GatewayDecision {
  return decisions.reduce((best, current) => {
    if (VERDICT_RANK[current.verdict] > VERDICT_RANK[best.verdict]) return current;
    if (current.verdict === best.verdict && current.riskScore > best.riskScore) return current;
    return best;
  });
}

export async function loadGatewayConfig() {
  const [policyRows, permissionRows] = await Promise.all([
    db.securityPolicy.findMany(),
    db.toolPermission.findMany(),
  ]);

  const policies =
    policyRows.length > 0
      ? policyRows
      : DEFAULT_POLICIES.map((policy) => ({
          detector: policy.detector,
          enabled: true,
          weight: policy.weight,
          name: policy.name,
        }));

  const permissions =
    permissionRows.length > 0
      ? permissionRows
      : DEFAULT_PERMISSIONS.map((row) => ({
          agentSlug: row.agentSlug,
          toolName: row.toolName,
          mode: row.mode,
        }));

  return { policies, permissions };
}

export async function evaluatePhase(input: {
  agent: Agent;
  action: string;
  instruction?: string | null;
  project: Project;
  task: Task;
  phase: "preflight" | "postflight";
  extraText?: string;
}): Promise<{ decision: GatewayDecision; tools: ProposedTool[] }> {
  const { policies, permissions } = await loadGatewayConfig();
  const tools = proposeTools(input);
  const text = [
    input.task.title,
    input.task.description,
    input.instruction || "",
    input.extraText || "",
  ].join("\n");

  const decisions = tools.map((tool) =>
    evaluateToolRequest({
      agent: input.agent,
      task: input.task,
      instruction: input.instruction,
      phase: input.phase,
      tool,
      text,
      policies,
      permissions,
    }),
  );

  return { decision: strictest(decisions), tools };
}
