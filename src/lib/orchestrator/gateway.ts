import type { Agent, Project, Task } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DANGEROUS_TOOLS,
  DEFAULT_PERMISSIONS,
  DEFAULT_POLICIES,
  TOOLS,
  type ToolName,
} from "@/lib/security";
import {
  canonicalizeTool,
  declaredLayerTools,
  toolMentionedInText,
} from "@/lib/tool-layer";
import { parseJson } from "@/lib/utils";
import {
  DANGER_TRIGGERS,
  evaluateSecurityGateway,
  strictest as strictestDecision,
  type GatewayDecision as SecurityGatewayDecision,
  type ProposedTool as GatewayProposedTool,
} from "@/lib/security-gateway";

export type ProposedTool = GatewayProposedTool;
export type GatewayDecision = SecurityGatewayDecision;

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
    (action === "implement" || action === "refactor" || action === "fix")
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
  }

  if (
    (role === "developer" || role === "refactoring") &&
    (action === "create_pr" || action === "open_pr")
  ) {
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

  if (role === "qa" || role === "test_generation" || role === "test_failure" || role === "verification") {
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
      arguments: { window: "incident", include: "traces" },
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
      .filter((item): item is ProposedTool => item !== null)
      .filter((item) => toolAllowedForAction(item.name, input.action));
    const extraDanger: ProposedTool[] = [];
    const seenDanger = new Set<string>();
    for (const name of DANGEROUS_TOOLS) {
      const canonical = canonicalizeTool(name);
      if (seenDanger.has(canonical)) continue;
      seenDanger.add(canonical);
      if (declaredCanonical.includes(canonical)) continue;
      const triggered = DANGER_TRIGGERS[canonical]?.test(text) || toolMentionedInText(canonical, text);
      if (!triggered) continue;
      const proposed = toolFromRegistry(canonical, input);
      if (proposed) extraDanger.push(proposed);
    }
    tools = [...declared, ...extraDanger];
  }

  for (const [name, trigger] of Object.entries(DANGER_TRIGGERS)) {
    if (!trigger.test(text)) continue;
    if (tools.some((tool) => canonicalizeTool(tool.name) === name)) continue;
    const proposed = toolFromRegistry(name, input);
    if (proposed) tools.push(proposed);
  }

  const seen = new Set<string>();
  return tools.filter((tool) => {
    const key = `${tool.name}:${tool.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toolAllowedForAction(name: string, action: string) {
  const canonical = canonicalizeTool(name);
  if (canonical === "github.create_pr" || canonical === "github.patch") {
    return action === "create_pr" || action === "open_pr";
  }
  return true;
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
  if (toolName === "db.delete" || toolName === "production_database.delete") {
    return {
      name: "db.delete",
      action: "delete",
      arguments: { env: "production", target: input.task.title },
    };
  }
  if (
    toolName === "external_api.send" ||
    toolName === "send_customer_data_to_external_api"
  ) {
    return {
      name: "external_api.send",
      action: "send",
      arguments: { destination: "external", payload: input.task.title },
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

export function evaluateToolRequest(input: {
  agent: Agent;
  task: Task;
  project?: Project | null;
  instruction?: string | null;
  phase: "preflight" | "postflight";
  tool: ProposedTool;
  text: string;
  policies: Array<{ detector: string; enabled: boolean; weight: number; name: string }>;
  permissions: Array<{ agentSlug: string; toolName: string; mode: string }>;
}): GatewayDecision {
  return evaluateSecurityGateway(input);
}

export function strictest(decisions: GatewayDecision[]): GatewayDecision {
  return strictestDecision(decisions);
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
      project: input.project,
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

/** Public Security Gateway entry. Agents request tools; they never call GitHub, databases, AWS, or APIs directly. */
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
