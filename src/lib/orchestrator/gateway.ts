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
import { TOOL_REQUIRED_PERMISSION } from "@/lib/registry";
import {
  canonicalizeTool,
  declaredLayerTools,
  isPlatformTool,
  isToolLayerName,
  permissionLookupNames,
  toolMentionedInText,
} from "@/lib/tool-layer";
import { parseJson } from "@/lib/utils";

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
  let tools: ProposedTool[] = [
    {
      name: "artifact.write",
      action: "emit",
      arguments: { task: input.task.title, agent: input.agent.slug },
    },
  ];

  if (input.project.githubUrl) {
    tools.push({
      name: "github.read_file",
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
      name: "github.search_code",
      action: "search",
      arguments: { path: "linked-repo" },
    });
    tools.push({
      name: "github.create_branch",
      action: "propose",
      arguments: { title: input.task.title },
    });
    tools.push({
      name: "github.create_pr",
      action: "propose",
      arguments: { title: input.task.title },
    });
  }

  if (role === "pr_reviewer" || role === "reviewer" || role === "code_reviewer") {
    tools.push({
      name: "github.get_diff",
      action: "diff",
      arguments: { focus: input.task.focusRef || null },
    });
    tools.push({
      name: "github.search_code",
      action: "search",
      arguments: { focus: input.task.focusRef || null },
    });
  }

  if (role === "qa" || role === "test_generation" || role === "test_failure") {
    tools.push({
      name: "ci.run_tests",
      action: "run",
      arguments: { suite: "default" },
    });
    if (role === "qa") {
      tools.push({
        name: "ci.run_lint",
        action: "run",
        arguments: {},
      });
    }
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
      name: "observability.get_logs",
      action: "read",
      arguments: { window: "incident" },
    });
    tools.push({
      name: "observability.get_metrics",
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
      name: "github.read_file",
      action: "read",
      arguments: { path: "linked-repo" },
    });
    tools.push({
      name: "ci.build",
      action: "build",
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
      name: "observability.get_metrics",
      action: "read",
      arguments: { slo: true },
    });
  }

  const declaredTools = parseJson<string[]>(input.agent.tools, []);
  if (declaredTools.length > 0) {
    const declaredCanonical = declaredLayerTools(declaredTools);
    const declared = declaredCanonical
      .map((name) => toolFromRegistry(name, input))
      .filter((item): item is ProposedTool => item !== null);
    const extraDanger: ProposedTool[] = [];
    const seenDanger = new Set<string>();
    for (const name of DANGEROUS_TOOLS) {
      const canonical = canonicalizeTool(name);
      if (seenDanger.has(canonical)) continue;
      seenDanger.add(canonical);
      if (declaredCanonical.includes(canonical)) continue;
      if (!toolMentionedInText(canonical, text)) continue;
      const proposed = toolFromRegistry(canonical, input);
      if (proposed) extraDanger.push(proposed);
    }
    tools = [...declared, ...extraDanger];
  }

  const seen = new Set<string>();
  return tools.filter((tool) => {
    const key = `${tool.name}:${tool.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toolFromRegistry(
  name: string,
  input: {
    agent: Agent;
    action: string;
    project: Project;
    task: Task;
  },
): ProposedTool | null {
  const canonical = canonicalizeTool(name);
  if (!TOOLS.some((item) => item.name === canonical) && !TOOLS.some((item) => item.name === name)) {
    return null;
  }
  const toolName = (TOOLS.some((item) => item.name === canonical) ? canonical : name) as ToolName;
  const repo = `${input.project.githubOwner}/${input.project.githubRepo}`;
  if (toolName === "artifact.write") {
    return {
      name: toolName,
      action: "emit",
      arguments: { task: input.task.title, agent: input.agent.slug },
    };
  }
  if (
    toolName === "github.read_file" ||
    toolName === "github.read" ||
    toolName === "github.fetch" ||
    toolName === "repo.read"
  ) {
    return {
      name: "github.read_file",
      action: "read",
      arguments: { repo, focus: input.task.focusRef || null },
    };
  }
  if (toolName === "github.search_code") {
    return {
      name: toolName,
      action: "search",
      arguments: { repo, query: input.task.title },
    };
  }
  if (toolName === "github.get_diff" || toolName === "github.diff" || toolName === "github.comment") {
    return {
      name: "github.get_diff",
      action: "diff",
      arguments: { repo, focus: input.task.focusRef || null },
    };
  }
  if (toolName === "github.create_branch") {
    return {
      name: toolName,
      action: "propose",
      arguments: { repo, title: input.task.title },
    };
  }
  if (toolName === "github.create_pr" || toolName === "github.patch") {
    return {
      name: "github.create_pr",
      action: "propose",
      arguments: { repo, title: input.task.title },
    };
  }
  if (toolName === "ci.run_tests" || toolName === "ci.run_lint") {
    return {
      name: toolName,
      action: "run",
      arguments: { suite: "default" },
    };
  }
  if (toolName === "ci.build" || toolName === "build.plan") {
    return {
      name: "ci.build",
      action: "build",
      arguments: { version: input.task.title },
    };
  }
  if (toolName === "observability.get_logs" || toolName === "logs.read") {
    return {
      name: "observability.get_logs",
      action: "read",
      arguments: { window: "incident" },
    };
  }
  if (toolName === "observability.get_metrics" || toolName === "metrics.read") {
    return {
      name: "observability.get_metrics",
      action: "read",
      arguments: { slo: true },
    };
  }
  return {
    name: toolName,
    action: input.action,
    arguments: { agent: input.agent.slug },
  };
}

function toolMeta(name: string) {
  const canonical = canonicalizeTool(name);
  return TOOLS.find((item) => item.name === canonical) ?? TOOLS.find((item) => item.name === name);
}

function permissionFor(
  permissions: Array<{ agentSlug: string; toolName: string; mode: string }>,
  agentSlug: string,
  toolName: string,
): PermissionMode {
  const names = permissionLookupNames(toolName);
  for (const name of names) {
    const specific = permissions.find(
      (row) => row.agentSlug === agentSlug && row.toolName === name,
    );
    if (specific) return specific.mode as PermissionMode;
  }
  for (const name of names) {
    const global = permissions.find(
      (row) => row.agentSlug === "*" && row.toolName === name,
    );
    if (global) return global.mode as PermissionMode;
  }
  return "require_approval";
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
  const canonicalTool = canonicalizeTool(input.tool.name);
  const knownTool = Boolean(toolMeta(input.tool.name)) || isToolLayerName(input.tool.name);
  const declaredTools = parseJson<string[]>(input.agent.tools, []);
  const declaredCanonical = declaredLayerTools(declaredTools);
  const grants = parseJson<string[]>(input.agent.permissions, []);
  const requiredGrant =
    TOOL_REQUIRED_PERMISSION[canonicalTool] ?? TOOL_REQUIRED_PERMISSION[input.tool.name];
  const analyzer = isSecurityAnalyzer(input.agent);
  const undeclared =
    !analyzer &&
    declaredCanonical.length > 0 &&
    !isPlatformTool(canonicalTool) &&
    !declaredCanonical.includes(canonicalTool) &&
    !declaredTools.includes(input.tool.name);
  const missingGrant =
    !analyzer &&
    grants.length > 0 &&
    Boolean(requiredGrant) &&
    !grants.includes(requiredGrant);

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
    if (undeclared) {
      hits.push({
        id: "tool_permission",
        name: "Agent Registry",
        score: enabled.tool_permission ?? 40,
        detail: `${input.tool.name} is not in ${input.agent.slug}’s declared tools.`,
      });
    }
    if (missingGrant && requiredGrant) {
      hits.push({
        id: "tool_permission",
        name: "Agent Registry",
        score: enabled.tool_permission ?? 40,
        detail: `${input.agent.slug} is missing permission ${requiredGrant}.`,
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
  const dangerous =
    (DANGEROUS_TOOLS as string[]).includes(input.tool.name) ||
    (DANGEROUS_TOOLS as string[]).includes(canonicalTool);
  const hostile = unique.some((hit) =>
    ["prompt_injection", "agent_hijacking", "rag_poisoning", "data_exfiltration"].includes(hit.id),
  );

  let verdict: GatewayDecision["verdict"] = "allow";
  if (!knownTool) {
    verdict = "deny";
    reasons.push(
      "Tool is not in the Tool Layer catalog. Agents cannot call GitHub, CI, or observability APIs directly.",
    );
  } else if (permissionMode === "deny" || undeclared || missingGrant) {
    verdict = "deny";
    if (permissionMode === "deny") {
      reasons.push(`Policy: ${input.tool.name} is denied.`);
    }
    if (undeclared) {
      reasons.push(`Registry: ${input.tool.name} is not in this agent’s tools.`);
    }
    if (missingGrant && requiredGrant) {
      reasons.push(`Registry: missing permission ${requiredGrant}.`);
    }
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

/** Public Tool Gateway entry. Agents request tools; they never call GitHub, CI, or observability directly. */
export async function requestTool(input: {
  agent: Agent;
  action: string;
  instruction?: string | null;
  project: Project;
  task: Task;
  phase: "preflight" | "postflight";
  extraText?: string;
}) {
  return evaluatePhase(input);
}
