import type { Agent } from "@prisma/client";
import { db } from "@/lib/db";
import { declaredLayerTools } from "@/lib/tool-layer";
import { slugify, uniqueSlug, parseJson } from "@/lib/utils";

export const DEFAULT_MODEL = "command-center.v1";

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const PERMISSION_GRANTS = [
  "read_repository",
  "write_repository",
  "comment_on_pull_request",
  "write_artifact",
  "retrieve_corpus",
  "write_memory",
  "call_mcp",
  "read_logs",
  "read_metrics",
  "run_ci",
  "inspect_deploy",
  "apply_deploy",
  "apply_rollback",
  "plan_build",
  "modify_production_config",
  "delete_database",
  "send_external",
  "read_secrets",
  "exec_shell",
] as const;
export type PermissionGrant = (typeof PERMISSION_GRANTS)[number];

export const TOOL_REQUIRED_PERMISSION: Record<string, PermissionGrant> = {
  "artifact.write": "write_artifact",
  "github.read_file": "read_repository",
  "github.search_code": "read_repository",
  "github.get_diff": "read_repository",
  "github.create_branch": "write_repository",
  "github.create_pr": "write_repository",
  "github.fetch": "read_repository",
  "github.read": "read_repository",
  "github.diff": "read_repository",
  "repo.read": "read_repository",
  "github.comment": "comment_on_pull_request",
  "github.patch": "write_repository",
  "ci.run_tests": "run_ci",
  "ci.run_lint": "run_ci",
  "ci.build": "run_ci",
  "observability.get_logs": "read_logs",
  "observability.get_metrics": "read_metrics",
  "web.fetch": "retrieve_corpus",
  "memory.write": "write_memory",
  "mcp.call": "call_mcp",
  "logs.read": "read_logs",
  "metrics.read": "read_metrics",
  "deploy.inspect": "inspect_deploy",
  "deploy.apply": "apply_deploy",
  "rollback.apply": "apply_rollback",
  "build.plan": "plan_build",
  "config.modify": "modify_production_config",
  "db.delete": "delete_database",
  "production_database.delete": "delete_database",
  "external_api.send": "send_external",
  "send_customer_data_to_external_api": "send_external",
  "secrets.read": "read_secrets",
  "shell.exec": "exec_shell",
};

export type AgentSpec = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  permissions: string[];
  model: string;
  systemPrompt: string;
  riskLevel: RiskLevel;
  enabled: boolean;
  role: string;
  domain: string;
};

export type RegisterAgentInput = {
  id?: string;
  name: string;
  description: string;
  capabilities?: string[] | string;
  tools?: string[] | string;
  permissions?: string[] | string;
  model?: string;
  systemPrompt?: string;
  riskLevel?: string;
  enabled?: boolean;
  role?: string;
  domain?: string;
};

type RoleDefaults = {
  tools: string[];
  permissions: string[];
  riskLevel: RiskLevel;
};

const GH_READ = ["github.read_file", "github.search_code", "github.get_diff"];
const GH_WRITE = ["github.create_branch", "github.create_pr"];
const CI_VERIFY = ["ci.run_tests", "ci.run_lint"];
const OBS = ["observability.get_logs", "observability.get_metrics"];

const ROLE_DEFAULTS: Record<string, RoleDefaults> = {
  architect: {
    tools: ["artifact.write", ...GH_READ],
    permissions: ["write_artifact", "read_repository"],
    riskLevel: "low",
  },
  developer: {
    tools: ["artifact.write", ...GH_READ, ...GH_WRITE],
    permissions: ["write_artifact", "read_repository", "write_repository"],
    riskLevel: "medium",
  },
  qa: {
    tools: ["artifact.write", ...GH_READ, ...CI_VERIFY],
    permissions: ["write_artifact", "read_repository", "run_ci"],
    riskLevel: "low",
  },
  reviewer: {
    tools: ["artifact.write", ...GH_READ],
    permissions: ["read_repository", "write_artifact"],
    riskLevel: "low",
  },
  pr_reviewer: {
    tools: ["artifact.write", ...GH_READ],
    permissions: ["read_repository", "write_artifact"],
    riskLevel: "low",
  },
  code_reviewer: {
    tools: [...GH_READ],
    permissions: ["read_repository"],
    riskLevel: "low",
  },
  verification: {
    tools: ["artifact.write", "github.read_file", "ci.run_tests"],
    permissions: ["write_artifact", "read_repository", "run_ci"],
    riskLevel: "medium",
  },
  bug_investigation: {
    tools: ["artifact.write", ...GH_READ],
    permissions: ["write_artifact", "read_repository"],
    riskLevel: "low",
  },
  test_generation: {
    tools: ["artifact.write", "github.read_file", "github.search_code", "ci.run_tests"],
    permissions: ["write_artifact", "read_repository", "run_ci"],
    riskLevel: "low",
  },
  test_failure: {
    tools: ["artifact.write", ...GH_READ, "ci.run_tests"],
    permissions: ["write_artifact", "read_repository", "run_ci"],
    riskLevel: "low",
  },
  refactoring: {
    tools: ["artifact.write", ...GH_READ, ...GH_WRITE, "ci.run_lint"],
    permissions: ["write_artifact", "read_repository", "write_repository", "run_ci"],
    riskLevel: "medium",
  },
  tech_debt: {
    tools: ["artifact.write", ...GH_READ],
    permissions: ["write_artifact", "read_repository"],
    riskLevel: "low",
  },
  documentation: {
    tools: ["artifact.write", "github.read_file", "web.fetch"],
    permissions: ["write_artifact", "read_repository", "retrieve_corpus"],
    riskLevel: "low",
  },
  incident: {
    tools: ["artifact.write", ...OBS, "deploy.inspect"],
    permissions: ["write_artifact", "read_logs", "read_metrics", "inspect_deploy"],
    riskLevel: "high",
  },
  monitoring: {
    tools: ["artifact.write", ...OBS],
    permissions: ["write_artifact", "read_logs", "read_metrics"],
    riskLevel: "medium",
  },
  log_analysis: {
    tools: ["artifact.write", "observability.get_logs"],
    permissions: ["write_artifact", "read_logs"],
    riskLevel: "medium",
  },
  root_cause: {
    tools: ["artifact.write", ...OBS, "github.read_file", "deploy.inspect"],
    permissions: ["write_artifact", "read_logs", "read_metrics", "read_repository", "inspect_deploy"],
    riskLevel: "high",
  },
  deployment: {
    tools: ["artifact.write", "deploy.inspect", "deploy.apply"],
    permissions: ["write_artifact", "inspect_deploy", "apply_deploy"],
    riskLevel: "high",
  },
  rollback: {
    tools: ["artifact.write", "deploy.inspect", "rollback.apply"],
    permissions: ["write_artifact", "inspect_deploy", "apply_rollback"],
    riskLevel: "high",
  },
  performance: {
    tools: ["artifact.write", ...OBS],
    permissions: ["write_artifact", "read_metrics", "read_logs"],
    riskLevel: "medium",
  },
  recovery: {
    tools: ["artifact.write", ...OBS, "deploy.inspect"],
    permissions: ["write_artifact", "read_logs", "read_metrics", "inspect_deploy"],
    riskLevel: "high",
  },
  security: {
    tools: ["artifact.write", ...GH_READ],
    permissions: ["write_artifact", "read_repository"],
    riskLevel: "medium",
  },
  prompt_injection: {
    tools: ["artifact.write"],
    permissions: ["write_artifact"],
    riskLevel: "low",
  },
  agent_hijacking: {
    tools: ["artifact.write"],
    permissions: ["write_artifact"],
    riskLevel: "medium",
  },
  rag_poisoning: {
    tools: ["artifact.write", "web.fetch"],
    permissions: ["write_artifact", "retrieve_corpus"],
    riskLevel: "medium",
  },
  mcp_security: {
    tools: ["artifact.write", "mcp.call"],
    permissions: ["write_artifact", "call_mcp"],
    riskLevel: "high",
  },
  data_exfiltration: {
    tools: ["artifact.write"],
    permissions: ["write_artifact"],
    riskLevel: "medium",
  },
  tool_permissions: {
    tools: ["artifact.write"],
    permissions: ["write_artifact"],
    riskLevel: "low",
  },
  security_gateway: {
    tools: ["artifact.write"],
    permissions: ["write_artifact"],
    riskLevel: "medium",
  },
  threat_response: {
    tools: ["artifact.write"],
    permissions: ["write_artifact"],
    riskLevel: "high",
  },
  release_analyst: {
    tools: ["artifact.write", ...GH_READ],
    permissions: ["write_artifact", "read_repository"],
    riskLevel: "low",
  },
  release_notes: {
    tools: ["artifact.write", "github.read_file"],
    permissions: ["write_artifact", "read_repository"],
    riskLevel: "low",
  },
  build: {
    tools: ["artifact.write", "github.read_file", "ci.build"],
    permissions: ["write_artifact", "read_repository", "run_ci"],
    riskLevel: "medium",
  },
  release_risk: {
    tools: ["artifact.write", "deploy.inspect", "observability.get_metrics"],
    permissions: ["write_artifact", "inspect_deploy", "read_metrics"],
    riskLevel: "high",
  },
};

const FALLBACK_DEFAULTS: RoleDefaults = {
  tools: ["artifact.write"],
  permissions: ["write_artifact"],
  riskLevel: "medium",
};

export const ORCHESTRATOR_MVP_ASCII = `                    AI ENGINEERING COMMAND CENTER
                               │
                               ↓
                         ORCHESTRATOR
                               │
                    ┌──────────┼──────────┐
                    ↓          ↓          ↓
               Architect    Developer     QA
                    │          │          │
                    └──────────┼──────────┘
                               ↓
                         Verification
                               ↓
                         Human Approval
                               ↓
                            Result`;

export const MVP_AGENT_IDS = ["architect", "developer", "qa"] as const;

export const CODE_REVIEWER_SPEC: AgentSpec = {
  id: "code-reviewer",
  name: "Code Reviewer",
  description:
    "Reviews diffs for bugs, regressions, and security issues. Read-only against the linked repository.",
  capabilities: ["review_code", "detect_bugs", "detect_security_issues"],
  tools: ["github.read_file", "github.search_code", "github.get_diff"],
  permissions: ["read_repository"],
  model: DEFAULT_MODEL,
  systemPrompt:
    "You are the Code Reviewer in the AI Engineering Command Center registry. Review the diff. Flag bugs and security issues. You may read the repository; you may not patch, deploy, or exec.",
  riskLevel: "low",
  enabled: true,
  role: "code_reviewer",
  domain: "development",
};

export function isRiskLevel(value: string): value is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(value);
}

export function splitList(value: string[] | string | null | undefined): string[] {
  const items = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/[\n,]+/)
        .map((item) => item.trim());
  return [...new Set(items.filter(Boolean))];
}

export function defaultsForRole(role: string, domain?: string): RoleDefaults {
  if (ROLE_DEFAULTS[role]) return ROLE_DEFAULTS[role];
  if (domain === "security") return ROLE_DEFAULTS.security;
  if (domain === "operations") return ROLE_DEFAULTS.incident;
  return FALLBACK_DEFAULTS;
}

export function specFromService(service: {
  slug: string;
  role: string;
  name: string;
  domain: string;
  description: string;
  capabilities: string[];
  tools?: string[];
  permissions?: string[];
  model?: string;
  riskLevel?: string;
  systemPrompt: string;
}): AgentSpec {
  const defaults = defaultsForRole(service.role, service.domain);
  return {
    id: service.slug,
    name: service.name,
    description: service.description,
    capabilities: service.capabilities,
    tools: declaredLayerTools(service.tools?.length ? service.tools : defaults.tools),
    permissions: service.permissions?.length ? service.permissions : defaults.permissions,
    model: service.model ?? DEFAULT_MODEL,
    systemPrompt: service.systemPrompt,
    riskLevel: service.riskLevel && isRiskLevel(service.riskLevel) ? service.riskLevel : defaults.riskLevel,
    enabled: true,
    role: service.role,
    domain: service.domain,
  };
}

export function toAgentRecord(agent: Agent): AgentSpec {
  const defaults = defaultsForRole(agent.role, agent.domain);
  const tools = parseJson<string[]>(agent.tools, []);
  const permissions = parseJson<string[]>(agent.permissions, []);
  return {
    id: agent.slug,
    name: agent.name,
    description: agent.description,
    capabilities: parseJson<string[]>(agent.capabilities, []),
    tools: declaredLayerTools(tools.length ? tools : defaults.tools),
    permissions: permissions.length ? permissions : defaults.permissions,
    model: agent.model || DEFAULT_MODEL,
    systemPrompt: agent.systemPrompt,
    riskLevel: isRiskLevel(agent.riskLevel) ? agent.riskLevel : defaults.riskLevel,
    enabled: agent.enabled,
    role: agent.role,
    domain: agent.domain,
  };
}

export function specToPublicJson(spec: AgentSpec) {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    capabilities: spec.capabilities,
    tools: spec.tools,
    permissions: spec.permissions,
    model: spec.model,
    system_prompt: spec.systemPrompt,
    risk_level: spec.riskLevel,
    enabled: spec.enabled,
  };
}

export function specToDb(spec: AgentSpec) {
  return {
    slug: spec.id,
    name: spec.name,
    role: spec.role,
    domain: spec.domain,
    description: spec.description,
    capabilities: JSON.stringify(spec.capabilities),
    tools: JSON.stringify(spec.tools),
    permissions: JSON.stringify(spec.permissions),
    model: spec.model,
    systemPrompt: spec.systemPrompt,
    riskLevel: spec.riskLevel,
    enabled: spec.enabled,
    status: spec.enabled ? "active" : "inactive",
  };
}

export async function listRegistryAgents(filter?: {
  enabled?: boolean;
  domain?: string;
}) {
  const agents = await db.agent.findMany({
    where: {
      ...(typeof filter?.enabled === "boolean" ? { enabled: filter.enabled } : {}),
      ...(filter?.domain ? { domain: filter.domain } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { workflowSteps: true, executionSteps: true } } },
  });
  return agents.map((agent) => ({
    ...agent,
    spec: toAgentRecord(agent),
  }));
}

export async function getRegistryAgent(idOrSlug: string) {
  const agent = await db.agent.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      workflowSteps: {
        include: { workflow: true },
        take: 12,
      },
    },
  });
  if (!agent) return null;
  return { ...agent, spec: toAgentRecord(agent) };
}

export async function findAgentsByCapability(capability: string) {
  const agents = await listRegistryAgents({ enabled: true });
  const needle = capability.trim().toLowerCase();
  return agents.filter((agent) =>
    agent.spec.capabilities.some((item) => item.toLowerCase() === needle),
  );
}

export async function registerAgent(input: RegisterAgentInput) {
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name || !description) {
    return { error: "Name and description are required." };
  }

  const requestedId = input.id?.trim() ? slugify(input.id.trim()) : uniqueSlug(name);
  const existing = await db.agent.findUnique({ where: { slug: requestedId } });
  if (existing) {
    return { error: `Registry already has an agent with id “${requestedId}”.` };
  }

  const role = input.role?.trim() || slugify(name).replaceAll("-", "_");
  const domain = input.domain?.trim() || "development";
  const defaults = defaultsForRole(role, domain);
  const riskLevel = input.riskLevel && isRiskLevel(input.riskLevel) ? input.riskLevel : defaults.riskLevel;
  const enabled = input.enabled !== false;
  const spec: AgentSpec = {
    id: requestedId,
    name,
    description,
    capabilities: splitList(input.capabilities),
    tools: declaredLayerTools(splitList(input.tools).length ? splitList(input.tools) : defaults.tools),
    permissions: splitList(input.permissions).length
      ? splitList(input.permissions)
      : defaults.permissions,
    model: input.model?.trim() || DEFAULT_MODEL,
    systemPrompt:
      input.systemPrompt?.trim() ||
      `You are the ${name} agent in the AI Engineering Command Center registry. Stay inside your declared tools and permissions.`,
    riskLevel,
    enabled,
    role,
    domain,
  };

  const agent = await db.agent.create({ data: specToDb(spec) });
  return { agent, spec };
}
