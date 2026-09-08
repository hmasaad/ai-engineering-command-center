export const TOOL_LAYER_ASCII = `GitHub
├── read_file
├── search_code
├── get_diff
├── create_branch
└── create_pr

CI
├── run_tests
├── run_lint
└── build

Observability
├── get_logs
└── get_metrics`;

export const TOOL_GATEWAY_ASCII = `                    Agent
                      ↓
                 Tool Request
                      ↓
              ┌───────────────┐
              │ Tool Gateway  │
              └───────┬───────┘
                      ↓
                 Policy Engine
                      ↓
             ┌────────┼────────┐
             ↓        ↓        ↓
           Allow     Deny    Approval`;

export type ToolLayerGroupId = "github" | "ci" | "observability";

export type ToolLayerDef = {
  name: string;
  short: string;
  group: ToolLayerGroupId;
  label: string;
  risk: number;
  sideEffect: boolean;
  description: string;
  permission: string;
};

export const TOOL_LAYER: ToolLayerDef[] = [
  {
    name: "github.read_file",
    short: "read_file",
    group: "github",
    label: "Read file",
    risk: 8,
    sideEffect: false,
    description: "Read a file from the linked repository. No write.",
    permission: "read_repository",
  },
  {
    name: "github.search_code",
    short: "search_code",
    group: "github",
    label: "Search code",
    risk: 8,
    sideEffect: false,
    description: "Search the linked repository. No write.",
    permission: "read_repository",
  },
  {
    name: "github.get_diff",
    short: "get_diff",
    group: "github",
    label: "Get diff",
    risk: 8,
    sideEffect: false,
    description: "Read a pull request or commit diff. No write.",
    permission: "read_repository",
  },
  {
    name: "github.create_branch",
    short: "create_branch",
    group: "github",
    label: "Create branch",
    risk: 26,
    sideEffect: true,
    description: "Propose a branch. Does not push until Execution.",
    permission: "write_repository",
  },
  {
    name: "github.create_pr",
    short: "create_pr",
    group: "github",
    label: "Create pull request",
    risk: 30,
    sideEffect: true,
    description: "Propose a pull request. Merge still needs a human.",
    permission: "write_repository",
  },
  {
    name: "ci.run_tests",
    short: "run_tests",
    group: "ci",
    label: "Run tests",
    risk: 16,
    sideEffect: true,
    description: "Request a test run. Does not shell out on the operator machine.",
    permission: "run_ci",
  },
  {
    name: "ci.run_lint",
    short: "run_lint",
    group: "ci",
    label: "Run lint",
    risk: 14,
    sideEffect: true,
    description: "Request lint. Does not shell out on the operator machine.",
    permission: "run_ci",
  },
  {
    name: "ci.build",
    short: "build",
    group: "ci",
    label: "Build",
    risk: 18,
    sideEffect: true,
    description: "Request a build. Artifact plan only — no compiler on the operator machine.",
    permission: "run_ci",
  },
  {
    name: "observability.get_logs",
    short: "get_logs",
    group: "observability",
    label: "Get logs",
    risk: 10,
    sideEffect: false,
    description: "Read production logs, traces, and error clusters.",
    permission: "read_logs",
  },
  {
    name: "observability.get_metrics",
    short: "get_metrics",
    group: "observability",
    label: "Get metrics",
    risk: 8,
    sideEffect: false,
    description: "Read SLO, latency, and error-rate signals.",
    permission: "read_metrics",
  },
];

export const TOOL_LAYER_GROUPS: Array<{
  id: ToolLayerGroupId;
  label: string;
}> = [
  { id: "github", label: "GitHub" },
  { id: "ci", label: "CI" },
  { id: "observability", label: "Observability" },
];

/** Old gateway names map onto the Tool Layer. Agents never call GitHub or CI directly. */
export const TOOL_ALIASES: Record<string, string> = {
  "github.read": "github.read_file",
  "github.fetch": "github.read_file",
  "repo.read": "github.read_file",
  "github.diff": "github.get_diff",
  "github.patch": "github.create_pr",
  "github.comment": "github.get_diff",
  "logs.read": "observability.get_logs",
  "metrics.read": "observability.get_metrics",
  "build.plan": "ci.build",
};

export const PLATFORM_TOOLS = ["artifact.write"] as const;

export const GITHUB_READ_TOOLS = [
  "github.read_file",
  "github.search_code",
  "github.get_diff",
] as const;

export function canonicalizeTool(name: string) {
  return TOOL_ALIASES[name] || name;
}

export function isToolLayerName(name: string) {
  const canonical = canonicalizeTool(name);
  return TOOL_LAYER.some((tool) => tool.name === canonical);
}

export function isPlatformTool(name: string) {
  return (PLATFORM_TOOLS as readonly string[]).includes(canonicalizeTool(name));
}

export function toolLayerDef(name: string) {
  const canonical = canonicalizeTool(name);
  return TOOL_LAYER.find((tool) => tool.name === canonical) ?? null;
}

export function declaredLayerTools(names: string[]) {
  return [...new Set(names.map(canonicalizeTool))];
}

export function aliasNamesFor(canonical: string) {
  return Object.entries(TOOL_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);
}

export function permissionLookupNames(toolName: string) {
  const canonical = canonicalizeTool(toolName);
  return [...new Set([toolName, canonical, ...aliasNamesFor(canonical)])];
}

export function toolMentionedInText(name: string, text: string) {
  const names = permissionLookupNames(name);
  const def = toolLayerDef(name);
  if (def && def.short.includes("_")) names.push(def.short);
  return names.some((item) => new RegExp(item.replaceAll(".", "\\."), "i").test(text));
}

export function layerToolsHint() {
  return TOOL_LAYER.map((tool) => tool.name).join(", ");
}
