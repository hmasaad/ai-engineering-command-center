export const DOMAINS = [
  { value: "development", label: "Development" },
  { value: "operations", label: "Operations" },
  { value: "security", label: "Security" },
  { value: "autonomous", label: "Autonomous" },
] as const;

export type ServiceDef = {
  slug: string;
  role: string;
  name: string;
  domain: "development" | "operations" | "security" | "autonomous";
  description: string;
  capabilities: string[];
  systemPrompt: string;
  defaultAction: string;
  requiresApproval: boolean;
  taskType: string;
};

export const DEVELOPMENT_SERVICES: ServiceDef[] = [
  {
    slug: "architect",
    role: "architect",
    name: "AI Software Architect",
    domain: "development",
    description:
      "Turns a task into a bounded technical plan: interfaces, risks, and what must be true before code is written.",
    capabilities: ["System design", "ADR-style plans", "Scope control", "Risk callouts"],
    systemPrompt:
      "You are the AI Software Architect service of Command Center Development Intelligence. Produce implementable plans, not essays.",
    defaultAction: "plan",
    requiresApproval: true,
    taskType: "feature",
  },
  {
    slug: "developer",
    role: "developer",
    name: "AI Developer",
    domain: "development",
    description:
      "Implements the approved plan as a vertical slice and hands a concrete change brief to review and tests.",
    capabilities: ["Implementation briefs", "Vertical slices", "Rollback notes", "Handoff"],
    systemPrompt:
      "You are the AI Developer service of Command Center Development Intelligence. Optimize for a small, reviewable change.",
    defaultAction: "implement",
    requiresApproval: false,
    taskType: "feature",
  },
  {
    slug: "pr-reviewer",
    role: "pr_reviewer",
    name: "PR Reviewer",
    domain: "development",
    description:
      "Reviews a pull request against intent, blast radius, and merge readiness. Uses GitHub PR metadata when linked.",
    capabilities: ["PR diffs", "Merge gates", "Risk comments", "Review verdict"],
    systemPrompt:
      "You are the PR Reviewer service of Command Center Development Intelligence. Recommend approve, request changes, or block.",
    defaultAction: "review",
    requiresApproval: true,
    taskType: "review",
  },
  {
    slug: "bug-investigation",
    role: "bug_investigation",
    name: "Bug Investigation",
    domain: "development",
    description:
      "Hypothesizes root cause from the symptom, GitHub issue, and recent commits, then produces a fix brief.",
    capabilities: ["Root-cause hypotheses", "Repro steps", "Blast radius", "Fix brief"],
    systemPrompt:
      "You are the Bug Investigation service of Command Center Development Intelligence. Separate facts from guesses.",
    defaultAction: "investigate",
    requiresApproval: false,
    taskType: "bug",
  },
  {
    slug: "test-generation",
    role: "test_generation",
    name: "Test Generation",
    domain: "development",
    description:
      "Writes a concrete test plan and case list for the change: happy path, failure, and one regression.",
    capabilities: ["Test cases", "Fixtures", "Assertions", "Coverage gaps"],
    systemPrompt:
      "You are the Test Generation service of Command Center Development Intelligence. Specify cases that could fail.",
    defaultAction: "generate",
    requiresApproval: false,
    taskType: "feature",
  },
  {
    slug: "test-failure-analyzer",
    role: "test_failure",
    name: "Test Failure Analyzer",
    domain: "development",
    description:
      "Reads a failing test or CI signal and classifies flake vs regression vs environment, with a next action.",
    capabilities: ["Failure classification", "Flake vs bug", "Suspect commits", "Retry policy"],
    systemPrompt:
      "You are the Test Failure Analyzer service of Command Center Development Intelligence. Do not guess a pass.",
    defaultAction: "analyze",
    requiresApproval: false,
    taskType: "bug",
  },
  {
    slug: "refactoring",
    role: "refactoring",
    name: "Refactoring",
    domain: "development",
    description:
      "Proposes a behavior-preserving refactor with a tight file list and a verification step.",
    capabilities: ["Behavior-preserving edits", "File lists", "Risk of drift", "Verification"],
    systemPrompt:
      "You are the Refactoring service of Command Center Development Intelligence. No behavior change without saying so.",
    defaultAction: "refactor",
    requiresApproval: true,
    taskType: "refactor",
  },
  {
    slug: "technical-debt",
    role: "tech_debt",
    name: "Technical Debt",
    domain: "development",
    description:
      "Inventories debt in the linked repo area, scores cost vs risk, and recommends what to pay down now.",
    capabilities: ["Debt inventory", "Cost/risk score", "Sequencing", "Stop-the-line items"],
    systemPrompt:
      "You are the Technical Debt service of Command Center Development Intelligence. Rank work, do not dump a backlog.",
    defaultAction: "audit",
    requiresApproval: false,
    taskType: "chore",
  },
  {
    slug: "documentation",
    role: "documentation",
    name: "Documentation",
    domain: "development",
    description:
      "Drafts operator-facing notes, README deltas, and runbook fragments for the change that just landed.",
    capabilities: ["README deltas", "Runbooks", "API notes", "Operator copy"],
    systemPrompt:
      "You are the Documentation service of Command Center Development Intelligence. Write for the next on-call, not for search engines.",
    defaultAction: "document",
    requiresApproval: false,
    taskType: "docs",
  },
];

export const PLATFORM_SERVICES: ServiceDef[] = [
  {
    slug: "qa",
    role: "qa",
    name: "QA",
    domain: "development",
    description:
      "Defines verification: happy path, failure path, regressions, and the evidence an operator should collect.",
    capabilities: ["Test charters", "Regression cases", "Evidence lists", "Release hold/go"],
    systemPrompt:
      "You are the QA capability of the AI Engineering Command Center. Be specific about what would falsify the change.",
    defaultAction: "test",
    requiresApproval: false,
    taskType: "feature",
  },
  {
    slug: "reviewer",
    role: "reviewer",
    name: "Reviewer",
    domain: "development",
    description:
      "Quality gate for a workflow step: correctness, blast radius, and whether the run is safe to continue.",
    capabilities: ["Code review lens", "Blast-radius checks", "Approval gates", "Reject-with-reason"],
    systemPrompt:
      "You are the Reviewer capability of the AI Engineering Command Center. Recommend approve or reject with reasons.",
    defaultAction: "review",
    requiresApproval: true,
    taskType: "review",
  },
];

export const ALL_SERVICES = [...DEVELOPMENT_SERVICES, ...PLATFORM_SERVICES];

export type PlaybookDef = {
  name: string;
  domain: "development" | "operations" | "security" | "autonomous";
  description: string;
  steps: Array<{
    agent: string;
    name: string;
    action: string;
    requiresApproval: boolean;
    instruction?: string;
  }>;
};

export const DEVELOPMENT_PLAYBOOKS: PlaybookDef[] = [
  {
    name: "Feature delivery",
    domain: "development",
    description:
      "Architect plans, human gate, Developer implements, Reviewer gates, QA verifies.",
    steps: [
      {
        agent: "architect",
        name: "Draft technical plan",
        action: "plan",
        requiresApproval: true,
        instruction: "Keep the change additive and name the rollback.",
      },
      {
        agent: "developer",
        name: "Implement the slice",
        action: "implement",
        requiresApproval: false,
      },
      {
        agent: "reviewer",
        name: "Review the change",
        action: "review",
        requiresApproval: true,
      },
      {
        agent: "qa",
        name: "Verify behavior",
        action: "test",
        requiresApproval: false,
      },
    ],
  },
  {
    name: "PR review",
    domain: "development",
    description: "PR Reviewer reads the linked pull request and pauses for a human merge gate.",
    steps: [
      {
        agent: "pr-reviewer",
        name: "Review the pull request",
        action: "review",
        requiresApproval: true,
        instruction: "Cite files and residual risk. Do not rubber-stamp.",
      },
    ],
  },
  {
    name: "Bug investigation",
    domain: "development",
    description:
      "Investigate the symptom, implement a contained fix, generate tests, then gate on PR Reviewer.",
    steps: [
      {
        agent: "bug-investigation",
        name: "Investigate root cause",
        action: "investigate",
        requiresApproval: false,
      },
      {
        agent: "developer",
        name: "Apply the fix",
        action: "implement",
        requiresApproval: false,
      },
      {
        agent: "test-generation",
        name: "Lock a regression test",
        action: "generate",
        requiresApproval: false,
      },
      {
        agent: "pr-reviewer",
        name: "Review the fix",
        action: "review",
        requiresApproval: true,
      },
    ],
  },
  {
    name: "Test failure",
    domain: "development",
    description:
      "Classify a failing test, patch if it is a real regression, then regenerate coverage.",
    steps: [
      {
        agent: "test-failure-analyzer",
        name: "Classify the failure",
        action: "analyze",
        requiresApproval: false,
      },
      {
        agent: "developer",
        name: "Repair or quarantine",
        action: "implement",
        requiresApproval: true,
      },
      {
        agent: "test-generation",
        name: "Strengthen the suite",
        action: "generate",
        requiresApproval: false,
      },
    ],
  },
  {
    name: "Pay down debt",
    domain: "development",
    description:
      "Inventory debt, design a bounded refactor, apply it, then review.",
    steps: [
      {
        agent: "technical-debt",
        name: "Inventory debt",
        action: "audit",
        requiresApproval: false,
      },
      {
        agent: "architect",
        name: "Bound the refactor",
        action: "plan",
        requiresApproval: true,
      },
      {
        agent: "refactoring",
        name: "Apply the refactor",
        action: "refactor",
        requiresApproval: false,
      },
      {
        agent: "pr-reviewer",
        name: "Review behavior freeze",
        action: "review",
        requiresApproval: true,
      },
    ],
  },
  {
    name: "Document the change",
    domain: "development",
    description: "Developer hands off; Documentation writes operator notes for the next human.",
    steps: [
      {
        agent: "developer",
        name: "Summarize what changed",
        action: "implement",
        requiresApproval: false,
      },
      {
        agent: "documentation",
        name: "Draft operator notes",
        action: "document",
        requiresApproval: false,
      },
    ],
  },
];

export const OTHER_PLAYBOOKS: PlaybookDef[] = [];
