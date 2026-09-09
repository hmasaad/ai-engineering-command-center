import type { Agent, Project, Task } from "@prisma/client";
import {
  DANGEROUS_TOOLS,
  DEFAULT_POLICIES,
  TOOLS,
  scanMcpTool,
  scanUntrustedText,
  type DetectorHit,
  type PermissionMode,
} from "@/lib/security";
import { TOOL_REQUIRED_PERMISSION } from "@/lib/registry";
import {
  canonicalizeTool,
  declaredLayerTools,
  isPlatformTool,
  isToolLayerName,
  permissionLookupNames,
} from "@/lib/tool-layer";
import {
  escalateHitl,
  hitlForTool,
  hitlLabel,
  stricterHitl,
  type HitlDecision,
} from "@/lib/hitl";
import { parseJson } from "@/lib/utils";

export const SECURITY_GATEWAY_UNSAFE_ASCII = `Developer Agent
      ↓
"Delete this database table"
      ↓
Database`;

export const SECURITY_GATEWAY_ASCII = `Developer Agent
      ↓
Tool Request
      ↓
┌───────────────────────┐
│   SECURITY GATEWAY    │
│                       │
│ Authentication        │
│ Authorization         │
│ Policy                │
│ Risk Analysis         │
│ Prompt Injection      │
│ Tool Validation       │
└───────────┬───────────┘
            ↓
       Allow / Deny /
       Human Approval
            ↓
          Tool`;

export const SECURITY_GATEWAY_EXAMPLE_ASCII = `Agent wants:

github.read_file
        ↓
Security Gateway
        ↓
Risk = LOW
        ↓
ALLOW

But:

Agent wants:

production_database.delete
        ↓
Security Gateway
        ↓
Risk = CRITICAL
        ↓
HUMAN APPROVAL

And:

Agent wants:

send_customer_data_to_external_api
        ↓
Security Gateway
        ↓
Potential data exfiltration
        ↓
BLOCK`;

export const SECURITY_GATEWAY_LAYERS = [
  "Authentication",
  "Authorization",
  "Policy",
  "Risk Analysis",
  "Prompt Injection",
  "Tool Validation",
] as const;

export type SecurityGatewayLayer = (typeof SECURITY_GATEWAY_LAYERS)[number];

export const SECURITY_GATEWAY_CHECK_DEFS = [
  { id: 1, question: "Who is the agent?", layer: "Authentication" },
  { id: 2, question: "What tool is being requested?", layer: "Tool Validation" },
  { id: 3, question: "What resources can the agent access?", layer: "Authorization" },
  { id: 4, question: "What arguments is it passing?", layer: "Tool Validation" },
  { id: 5, question: "What data is being sent?", layer: "Policy" },
  { id: 6, question: "Is the action allowed by policy?", layer: "Policy" },
  { id: 7, question: "Is there prompt injection?", layer: "Prompt Injection" },
  { id: 8, question: "Is there suspicious behavior?", layer: "Risk Analysis" },
  { id: 9, question: "What's the risk level?", layer: "Risk Analysis" },
  { id: 10, question: "Does this require human approval?", layer: "Risk Analysis" },
] as const;

export type GatewayCheckStatus = "pass" | "hold" | "fail";

export type GatewayCheck = {
  id: number;
  question: string;
  layer: SecurityGatewayLayer;
  status: GatewayCheckStatus;
  detail: string;
};

export type ProposedTool = {
  name: string;
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
  checks: GatewayCheck[];
  summary: string;
  permissionMode: PermissionMode;
  hitl: HitlDecision;
};

const VERDICT_RANK = { allow: 0, human: 1, deny: 2 } as const;
const CHECK_RANK: Record<GatewayCheckStatus, number> = { pass: 0, hold: 1, fail: 2 };

/** Always blocked. Not a human-approval path — data must not leave. */
export const HARD_DENY_TOOLS = [
  "secrets.read",
  "shell.exec",
  "external_api.send",
  "send_customer_data_to_external_api",
] as const;

export const EGRESS_TOOLS = [
  "external_api.send",
  "send_customer_data_to_external_api",
  "web.fetch",
  "mcp.call",
  "memory.write",
] as const;

const CUSTOMER_DATA_RE =
  /\b(customer[\s_-]*data|customer[\s_-]*email|ssns?|social[\s_-]*security|credit[\s_-]*card|pii|personal[\s_-]*data|user[\s_-]*records?)\b/i;

const EXFIL_SINK_RE =
  /webhook\.site|pastebin\.com|ngrok\.io|discord\.com\/api\/webhooks|external[_-]?api|untrusted\s+(endpoint|api)/i;

const ARG_ATTACK_RE =
  /\b(drop\s+table|truncate\s+|rm\s+-rf|curl\s+https?:\/\/|wget\s+)/i;

export const DANGER_TRIGGERS: Record<string, RegExp> = {
  "db.delete":
    /db\.delete|production_database\.delete|delete\s+(this\s+)?(the\s+)?(database|db)\s+table|drop\s+table|truncate\s+(table|database)/i,
  "external_api.send":
    /external_api\.send|send_customer_data_to_external_api|send\s+.{0,80}customer\s+data|send\s+.{0,80}to\s+(an\s+)?external\s+api/i,
  "secrets.read": /secrets\.read|process\.env|github_token|\.env/i,
  "shell.exec": /shell\.exec|rm\s+-rf|cat\s+\/etc/i,
  "mcp.call": /\bmcp\b|tools\/call/i,
};

const ANALYZER_ROLES = [
  "prompt_injection",
  "agent_hijacking",
  "rag_poisoning",
  "data_exfiltration",
  "mcp_security",
  "security_gateway",
  "tool_permissions",
  "security",
  "threat_response",
];

function check(
  id: number,
  status: GatewayCheckStatus,
  detail: string,
): GatewayCheck {
  const def = SECURITY_GATEWAY_CHECK_DEFS[id - 1];
  return {
    id,
    question: def.question,
    layer: def.layer,
    status,
    detail,
  };
}

function worse(a: GatewayCheckStatus, b: GatewayCheckStatus): GatewayCheckStatus {
  return CHECK_RANK[a] >= CHECK_RANK[b] ? a : b;
}

function isSecurityAnalyzer(agent: Agent) {
  return agent.domain === "security" && ANALYZER_ROLES.includes(agent.role);
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
  if (HARD_DENY_TOOLS.includes(canonicalizeTool(toolName) as (typeof HARD_DENY_TOOLS)[number])) {
    return "deny";
  }
  if (HARD_DENY_TOOLS.includes(toolName as (typeof HARD_DENY_TOOLS)[number])) {
    return "deny";
  }
  return "require_approval";
}

function mergeHits(hits: DetectorHit[]): DetectorHit[] {
  const byKey = new Map<string, DetectorHit>();
  for (const hit of hits) {
    const key = `${hit.id}:${hit.detail}`;
    if (!byKey.has(key)) byKey.set(key, hit);
  }
  return [...byKey.values()];
}

function stringifyArgs(args: Record<string, unknown>) {
  try {
    return JSON.stringify(args);
  } catch {
    return "";
  }
}

export function layerStatus(checks: GatewayCheck[], layer: SecurityGatewayLayer): GatewayCheckStatus {
  return checks
    .filter((item) => item.layer === layer)
    .reduce<GatewayCheckStatus>((best, item) => worse(best, item.status), "pass");
}

export function evaluateSecurityGateway(input: {
  agent: Agent;
  task: Task;
  project?: Pick<Project, "githubOwner" | "githubRepo" | "name"> | null;
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
  if (
    policyOn("prompt_injection") ||
    policyOn("agent_hijacking") ||
    policyOn("rag_poisoning") ||
    policyOn("data_exfiltration")
  ) {
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
  const hardDeny =
    HARD_DENY_TOOLS.includes(canonicalTool as (typeof HARD_DENY_TOOLS)[number]) ||
    HARD_DENY_TOOLS.includes(input.tool.name as (typeof HARD_DENY_TOOLS)[number]);
  const egress =
    EGRESS_TOOLS.includes(canonicalTool as (typeof EGRESS_TOOLS)[number]) ||
    EGRESS_TOOLS.includes(input.tool.name as (typeof EGRESS_TOOLS)[number]);
  const argBlob = stringifyArgs(input.tool.arguments);
  const payload = `${input.text}\n${argBlob}`;
  const customerData = CUSTOMER_DATA_RE.test(payload);
  const exfilSink = EXFIL_SINK_RE.test(payload);
  const exfilHits = hits.filter((hit) => hit.id === "data_exfiltration");
  const injectionHits = hits.filter((hit) =>
    ["prompt_injection", "rag_poisoning"].includes(hit.id),
  );
  const hijackHits = hits.filter((hit) => hit.id === "agent_hijacking");
  const mcpHits = hits.filter((hit) => hit.id === "mcp_security");
  const argAttack = ARG_ATTACK_RE.test(argBlob) || ARG_ATTACK_RE.test(input.tool.action);

  if (policyOn("tool_permission")) {
    if (permissionMode === "deny") {
      hits.push({
        id: "tool_permission",
        name: "Tool Permission Manager",
        score: enabled.tool_permission ?? 40,
        detail: `${input.tool.name} is denied for ${input.agent.name}.`,
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

  const dangerous =
    (DANGEROUS_TOOLS as string[]).includes(input.tool.name) ||
    (DANGEROUS_TOOLS as string[]).includes(canonicalTool);
  const hostile = unique.some((hit) =>
    ["prompt_injection", "agent_hijacking", "rag_poisoning", "data_exfiltration"].includes(hit.id),
  );

  let hitl = hitlForTool(canonicalTool);
  if (hostile && !analyzer) hitl = escalateHitl(hitl);
  if (input.task.priority === "critical" && hitl.mode === "recommended") {
    hitl = escalateHitl(hitl);
  }

  const projectRepo =
    input.project?.githubOwner && input.project?.githubRepo
      ? `${input.project.githubOwner}/${input.project.githubRepo}`
      : null;
  const requestedRepo =
    typeof input.tool.arguments.repo === "string" ? input.tool.arguments.repo : null;
  const repoMismatch = Boolean(projectRepo && requestedRepo && requestedRepo !== projectRepo);

  const agentActive = input.agent.enabled && input.agent.status !== "inactive";
  const checks: GatewayCheck[] = [];

  checks.push(
    agentActive
      ? check(
          1,
          "pass",
          `Registry identity ${input.agent.slug} (${input.agent.role}). Role is not taken from the prompt.`,
        )
      : check(1, "fail", `${input.agent.slug} is disabled or inactive. Authentication failed.`),
  );

  checks.push(
    knownTool
      ? check(2, "pass", `\`${canonicalTool}\` / ${input.tool.action} is a catalogued tool request.`)
      : check(
          2,
          "fail",
          `\`${input.tool.name}\` is not in the catalog. Agents cannot call GitHub, databases, AWS, or APIs directly.`,
        ),
  );

  if (repoMismatch) {
    checks.push(
      check(
        3,
        "fail",
        `Requested repo ${requestedRepo} is outside project resource ${projectRepo}.`,
      ),
    );
  } else if (missingGrant && requiredGrant && hitl.mode !== "mandatory" && !hardDeny) {
    checks.push(
      check(3, "fail", `${input.agent.slug} has no grant ${requiredGrant} for this resource.`),
    );
  } else if (undeclared && hitl.mode !== "mandatory" && !hardDeny) {
    checks.push(
      check(3, "fail", `\`${canonicalTool}\` is not in this agent’s declared tools.`),
    );
  } else if ((missingGrant || undeclared) && (hitl.mode === "mandatory" || hardDeny)) {
    checks.push(
      check(
        3,
        hardDeny ? "fail" : "hold",
        hardDeny
          ? `${input.agent.slug} is not authorized for \`${canonicalTool}\`.`
          : `${input.agent.slug} is not pre-authorized for \`${canonicalTool}\`. A human must grant this resource.`,
      ),
    );
  } else {
    const resource =
      requestedRepo ||
      projectRepo ||
      (canonicalTool === "db.delete" ? "production database" : input.project?.name || "this project");
    checks.push(
      check(3, "pass", `Scoped to ${resource}. Least privilege from the Agent Registry.`),
    );
  }

  if (argAttack && !analyzer) {
    checks.push(
      check(4, "fail", `Tool arguments look like a destructive or egress payload (${input.tool.action}).`),
    );
  } else {
    const keys = Object.keys(input.tool.arguments);
    checks.push(
      check(
        4,
        "pass",
        keys.length > 0
          ? `Arguments: ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? "…" : ""}.`
          : "No extra arguments.",
      ),
    );
  }

  const exfilAttempt = (customerData && (egress || exfilSink)) || (exfilHits.length > 0 && egress);
  if (exfilAttempt && !analyzer) {
    checks.push(
      check(
        5,
        "fail",
        "Potential data exfiltration — customer or secret data toward an external sink. BLOCK.",
      ),
    );
  } else if ((customerData || exfilHits.length > 0) && !analyzer) {
    checks.push(
      check(
        5,
        egress ? "fail" : "hold",
        customerData
          ? "Customer or PII-shaped data is in the payload. Do not send it off-box."
          : exfilHits[0]?.detail || "Exfil detector hit on this payload.",
      ),
    );
  } else {
    checks.push(check(5, "pass", "No customer data, secrets, or paste/webhook sink in this request."));
  }

  if (!analyzer && (permissionMode === "deny" || hardDeny)) {
    checks.push(check(6, "fail", `Policy: \`${canonicalTool}\` is denied.`));
  } else if (!analyzer && permissionMode === "require_approval") {
    checks.push(check(6, "hold", `Policy: \`${canonicalTool}\` requires human approval.`));
  } else if (!analyzer && undeclared && hitl.mode !== "mandatory") {
    checks.push(check(6, "fail", `Policy: undeclared tool \`${canonicalTool}\`.`));
  } else {
    checks.push(check(6, "pass", `Policy mode ${permissionMode} for ${input.agent.slug}.`));
  }

  if (injectionHits.length > 0 && !analyzer) {
    checks.push(
      check(
        7,
        dangerous || egress ? "fail" : "hold",
        injectionHits[0]?.detail || "Prompt injection language in untrusted input.",
      ),
    );
  } else {
    checks.push(
      check(
        7,
        "pass",
        analyzer && injectionHits.length > 0
          ? `Detector reporting ${injectionHits.length} injection hit(s); analyzer may complete.`
          : "No prompt-injection or RAG-poison patterns.",
      ),
    );
  }

  const suspicious = [...hijackHits, ...mcpHits];
  if (!analyzer && (hijackHits.length > 0 || (mcpHits.length > 0 && dangerous))) {
    checks.push(
      check(
        8,
        hijackHits.length > 0 || hardDeny ? "fail" : "hold",
        suspicious[0]?.detail || "Suspicious tool or hijack language.",
      ),
    );
  } else if (!analyzer && riskScore >= 88 && dangerous && hitl.mode !== "mandatory") {
    checks.push(
      check(8, "fail", "Risk score at deny threshold for a side-effecting tool."),
    );
  } else if (!analyzer && riskScore >= 88 && dangerous) {
    checks.push(
      check(8, "hold", "Critical risk on a side-effecting tool. A human must approve."),
    );
  } else {
    checks.push(check(8, "pass", "No hijack, MCP-abuse, or deny-threshold anomaly."));
  }

  checks.push(
    check(
      9,
      "pass",
      `${hitl.band.toUpperCase()} · score ${riskScore}/100 · ${hitl.action}.`,
    ),
  );

  const holdNow =
    (input.phase === "preflight" && hitl.mode === "mandatory") ||
    (input.phase === "postflight" && (hitl.mode === "recommended" || hitl.mode === "mandatory"));
  if (!analyzer && holdNow) {
    checks.push(
      check(10, "hold", `${hitl.action} is ${hitl.band} risk — ${hitlLabel(hitl)}.`),
    );
  } else if (!analyzer && hostile && dangerous) {
    checks.push(check(10, "hold", "Hostile input combined with a side-effecting tool."));
  } else {
    checks.push(
      check(
        10,
        "pass",
        hitl.mode === "automatic"
          ? `${hitl.action} is low risk. Automatic.`
          : analyzer
            ? "Analyzer: human pause skipped so the detector can report."
            : `${hitlLabel(hitl)} is not required in this phase.`,
      ),
    );
  }

  let verdict: GatewayDecision["verdict"] = "allow";
  if (checks.some((item) => item.status === "fail")) verdict = "deny";
  else if (checks.some((item) => item.status === "hold")) verdict = "human";

  if (!knownTool) verdict = "deny";

  if (analyzer && verdict === "deny" && permissionMode !== "deny" && !hardDeny) {
    verdict = "human";
  }
  if (analyzer && verdict === "human" && permissionMode !== "deny" && !undeclared) {
    verdict = "allow";
  }
  if (analyzer && !dangerous && permissionMode === "allow") {
    verdict = "allow";
  }

  const reasons = [
    ...checks.filter((item) => item.status !== "pass").map((item) => `${item.question} ${item.detail}`),
    ...unique.map((hit) => `${hit.name}: ${hit.detail}`),
  ];
  if (reasons.length === 0) {
    reasons.push(
      hitl.mode === "automatic"
        ? `HITL: ${hitl.action} is low risk. Automatic.`
        : "No detector hits. Tool is within the default allow list.",
    );
  }

  const summary = `${verdict.toUpperCase()} · ${input.tool.name} · HITL ${hitl.band} / ${hitlLabel(hitl).toLowerCase()} · risk ${riskScore} · ${input.agent.name} (${input.phase})`;

  return {
    phase: input.phase,
    tool: input.tool,
    riskScore,
    verdict,
    reasons: [...new Set(reasons)],
    detectors: unique,
    checks,
    summary,
    permissionMode,
    hitl,
  };
}

export function strictest(decisions: GatewayDecision[]): GatewayDecision {
  return decisions.reduce((best, current) => {
    if (VERDICT_RANK[current.verdict] > VERDICT_RANK[best.verdict]) return current;
    if (current.verdict === best.verdict) {
      if (current.verdict === "human" && current.hitl && best.hitl) {
        return stricterHitl(current.hitl, best.hitl) === current.hitl ? current : best;
      }
      if (current.riskScore > best.riskScore) return current;
    }
    return best;
  });
}

export function formatGatewayChecks(checks: GatewayCheck[]) {
  return checks
    .map((item) => {
      const mark = item.status === "fail" ? "BLOCK" : item.status === "hold" ? "HOLD" : "PASS";
      return `${item.id}. ${item.question}  [${mark}]  ${item.detail}`;
    })
    .join("\n");
}

export function securityGatewayExamples() {
  return [
    {
      tool: "github.read_file",
      risk: "LOW",
      verdict: "ALLOW" as const,
      why: "Read-only repository access. Authenticated agent, catalogued tool, low risk.",
    },
    {
      tool: "production_database.delete",
      risk: "CRITICAL",
      verdict: "HUMAN APPROVAL" as const,
      why: "Destructive production data. Mandatory human approval even if the Developer asked.",
    },
    {
      tool: "send_customer_data_to_external_api",
      risk: "CRITICAL",
      verdict: "BLOCK" as const,
      why: "Potential data exfiltration. The gateway denies — a human cannot click this through as a routine approve.",
    },
  ];
}
