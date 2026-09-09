import { canonicalizeTool } from "@/lib/tool-layer";

export type RiskBand = "low" | "medium" | "high" | "critical";
export type HitlMode = "automatic" | "recommended" | "mandatory";

export const HITL_ASCII = `LOW RISK
  ↓
Automatic

MEDIUM RISK
  ↓
Review recommended

HIGH RISK
  ↓
Mandatory approval`;

export type HitlAction = {
  action: string;
  band: RiskBand;
  approval: "No" | "Optional" | "Yes";
  mode: HitlMode;
  tools: string[];
};

export const HITL_ACTIONS: HitlAction[] = [
  {
    action: "Read repository",
    band: "low",
    approval: "No",
    mode: "automatic",
    tools: ["github.read_file", "github.search_code", "github.get_diff", "github.read", "github.diff", "repo.read", "github.fetch"],
  },
  {
    action: "Run tests",
    band: "low",
    approval: "No",
    mode: "automatic",
    tools: ["ci.run_tests", "ci.run_lint"],
  },
  {
    action: "Create branch",
    band: "low",
    approval: "No",
    mode: "automatic",
    tools: ["github.create_branch"],
  },
  {
    action: "Create PR",
    band: "medium",
    approval: "Optional",
    mode: "recommended",
    tools: ["github.create_pr", "github.patch"],
  },
  {
    action: "Modify production config",
    band: "high",
    approval: "Yes",
    mode: "mandatory",
    tools: ["config.modify"],
  },
  {
    action: "Deploy production",
    band: "critical",
    approval: "Yes",
    mode: "mandatory",
    tools: ["deploy.apply"],
  },
  {
    action: "Delete database data",
    band: "critical",
    approval: "Yes",
    mode: "mandatory",
    tools: ["db.delete", "production_database.delete"],
  },
];

const BAND_RANK: Record<RiskBand, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const MODE_RANK: Record<HitlMode, number> = {
  automatic: 0,
  recommended: 1,
  mandatory: 2,
};

export type HitlDecision = {
  band: RiskBand;
  mode: HitlMode;
  action: string;
  approval: HitlAction["approval"];
};

const FALLBACK: HitlDecision = {
  band: "medium",
  mode: "recommended",
  action: "Unknown action",
  approval: "Optional",
};

const BY_TOOL = new Map<string, HitlAction>();
for (const row of HITL_ACTIONS) {
  for (const tool of row.tools) {
    BY_TOOL.set(tool, row);
  }
}

const EXTRA_TOOLS: Record<string, HitlDecision> = {
  "artifact.write": { band: "low", mode: "automatic", action: "Write artifact", approval: "No" },
  "observability.get_logs": { band: "low", mode: "automatic", action: "Get logs", approval: "No" },
  "observability.get_metrics": { band: "low", mode: "automatic", action: "Get metrics", approval: "No" },
  "logs.read": { band: "low", mode: "automatic", action: "Get logs", approval: "No" },
  "metrics.read": { band: "low", mode: "automatic", action: "Get metrics", approval: "No" },
  "deploy.inspect": { band: "low", mode: "automatic", action: "Inspect deploy", approval: "No" },
  "ci.build": { band: "medium", mode: "recommended", action: "Build", approval: "Optional" },
  "build.plan": { band: "medium", mode: "recommended", action: "Build", approval: "Optional" },
  "rollback.apply": { band: "critical", mode: "mandatory", action: "Deploy production", approval: "Yes" },
  "web.fetch": { band: "medium", mode: "recommended", action: "Retrieve corpus", approval: "Optional" },
  "memory.write": { band: "medium", mode: "recommended", action: "Write memory", approval: "Optional" },
  "mcp.call": { band: "high", mode: "mandatory", action: "MCP call", approval: "Yes" },
  "secrets.read": { band: "critical", mode: "mandatory", action: "Read secrets", approval: "Yes" },
  "shell.exec": { band: "critical", mode: "mandatory", action: "Shell exec", approval: "Yes" },
  "external_api.send": { band: "critical", mode: "mandatory", action: "Send to external API", approval: "Yes" },
  "send_customer_data_to_external_api": {
    band: "critical",
    mode: "mandatory",
    action: "Send customer data off-box",
    approval: "Yes",
  },
};

export function hitlForTool(name: string): HitlDecision {
  const canonical = canonicalizeTool(name);
  const row = BY_TOOL.get(canonical) ?? BY_TOOL.get(name);
  if (row) {
    return { band: row.band, mode: row.mode, action: row.action, approval: row.approval };
  }
  return EXTRA_TOOLS[canonical] ?? EXTRA_TOOLS[name] ?? { ...FALLBACK, action: name };
}

export function hitlForTools(names: string[]): HitlDecision {
  if (names.length === 0) {
    return { band: "low", mode: "automatic", action: "No tools", approval: "No" };
  }
  return names.map(hitlForTool).reduce((best, current) =>
    stricterHitl(current, best) === current ? current : best,
  );
}

export function stricterHitl(a: HitlDecision, b: HitlDecision): HitlDecision {
  if (MODE_RANK[a.mode] !== MODE_RANK[b.mode]) {
    return MODE_RANK[a.mode] > MODE_RANK[b.mode] ? a : b;
  }
  return BAND_RANK[a.band] >= BAND_RANK[b.band] ? a : b;
}

export function escalateHitl(decision: HitlDecision, hops = 1): HitlDecision {
  let mode = decision.mode;
  let band = decision.band;
  for (let i = 0; i < hops; i += 1) {
    if (mode === "automatic") {
      mode = "recommended";
      if (BAND_RANK[band] < BAND_RANK.medium) band = "medium";
    } else if (mode === "recommended") {
      mode = "mandatory";
      if (BAND_RANK[band] < BAND_RANK.high) band = "high";
    } else {
      band = "critical";
    }
  }
  return {
    ...decision,
    mode,
    band,
    approval: mode === "automatic" ? "No" : mode === "recommended" ? "Optional" : "Yes",
  };
}

export function shouldPauseForHitl(decision: HitlDecision) {
  return decision.mode === "recommended" || decision.mode === "mandatory";
}

export function isExplicitHumanGate(step: { name: string; action: string }) {
  if (/human approval|approval gate/i.test(step.name)) return true;
  return step.action === "approve" || step.action === "gate";
}

export function hitlLabel(decision: HitlDecision) {
  if (decision.mode === "automatic") return "Automatic";
  if (decision.mode === "recommended") return "Review recommended";
  return "Mandatory approval";
}

export function approvalKindFor(decision: HitlDecision) {
  return decision.mode === "recommended" ? "recommended" : "mandatory";
}
