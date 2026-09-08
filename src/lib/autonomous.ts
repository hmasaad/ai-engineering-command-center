import type { PlaybookDef, ServiceDef } from "@/lib/development";

export const AUTONOMOUS_SERVICES: ServiceDef[] = [
  {
    slug: "release-analyst",
    role: "release_analyst",
    name: "Release Analyst",
    domain: "autonomous",
    description:
      "Reads recent commits, PRs, and the requested version, then names what actually landed in the release.",
    capabilities: ["Changelog diff", "Commit clustering", "Breaking-change flags", "Scope"],
    systemPrompt:
      "You are the Release Analyst of Command Center Autonomous Engineering. Inventory the change set. Do not write the notes yet.",
    defaultAction: "analyze",
    requiresApproval: false,
    taskType: "release",
  },
  {
    slug: "release-notes",
    role: "release_notes",
    name: "Release Notes",
    domain: "autonomous",
    description:
      "Turns the analyzed change set into operator-facing release notes for the named version.",
    capabilities: ["Highlights", "Breaking changes", "Upgrade notes", "Thanks"],
    systemPrompt:
      "You are the Release Notes service of Command Center Autonomous Engineering. Write for operators shipping the version, not marketing.",
    defaultAction: "document",
    requiresApproval: false,
    taskType: "release",
  },
  {
    slug: "build",
    role: "build",
    name: "Build Agent",
    domain: "autonomous",
    description:
      "Plans the release build: artifacts, version stamp, and verification. Does not shell out.",
    capabilities: ["Build graph", "Version stamp", "Artifact list", "Smoke checks"],
    systemPrompt:
      "You are the Build Agent of Command Center Autonomous Engineering. Propose the build. Never claim a binary was produced on the operator machine.",
    defaultAction: "build",
    requiresApproval: false,
    taskType: "release",
  },
  {
    slug: "release-risk",
    role: "release_risk",
    name: "Release Risk Agent",
    domain: "autonomous",
    description:
      "Scores deploy risk for the named version and pauses for a human before production apply.",
    capabilities: ["Blast radius", "Rollback window", "SLO exposure", "Go / no-go"],
    systemPrompt:
      "You are the Release Risk Agent of Command Center Autonomous Engineering. Recommend go or no-go. A human must still approve.",
    defaultAction: "audit",
    requiresApproval: true,
    taskType: "release",
  },
];

export const RELEASE_FLOW: Array<{
  label: string;
  agent: string;
  gate?: boolean;
}> = [
  { label: "Analyze Changes", agent: "release-analyst" },
  { label: "Generate Release Notes", agent: "release-notes" },
  { label: "Architecture Review", agent: "architect" },
  { label: "Code Review", agent: "pr-reviewer" },
  { label: "Security Scan", agent: "security" },
  { label: "Test Suite", agent: "test-generation" },
  { label: "Regression Analysis", agent: "test-failure-analyzer" },
  { label: "Build", agent: "build" },
  { label: "Deployment Risk Analysis", agent: "release-risk" },
  { label: "Human Approval", agent: "release-risk", gate: true },
  { label: "Deploy", agent: "deployment" },
  { label: "Monitor", agent: "monitoring" },
  { label: "Post-release Verification", agent: "recovery" },
];

export const AUTONOMOUS_PLAYBOOKS: PlaybookDef[] = [
  {
    name: "Release",
    domain: "autonomous",
    description:
      "Intent-driven release: analyze changes, notes, architecture, code review, security, tests, regression, build, risk gate, deploy, monitor, verify.",
    steps: [
      {
        agent: "release-analyst",
        name: "Analyze Changes",
        action: "analyze",
        requiresApproval: false,
        instruction: "Cluster commits and open PRs into what actually ships in this version.",
      },
      {
        agent: "release-notes",
        name: "Generate Release Notes",
        action: "document",
        requiresApproval: false,
        instruction: "Operator-facing notes for the named version. Call out breaking changes.",
      },
      {
        agent: "architect",
        name: "Architecture Review",
        action: "review",
        requiresApproval: false,
        instruction: "Is this version still a bounded change? Name coupling and rollback.",
      },
      {
        agent: "pr-reviewer",
        name: "Code Review",
        action: "review",
        requiresApproval: false,
        instruction: "Review the change set as if it were the release PR. Do not rubber-stamp.",
      },
      {
        agent: "security",
        name: "Security Scan",
        action: "scan",
        requiresApproval: false,
        instruction: "Scan the release brief and notes. Gateway still sits in front of deploy.apply.",
      },
      {
        agent: "test-generation",
        name: "Test Suite",
        action: "generate",
        requiresApproval: false,
        instruction: "Name the suite that must be green before this version ships.",
      },
      {
        agent: "test-failure-analyzer",
        name: "Regression Analysis",
        action: "analyze",
        requiresApproval: false,
        instruction: "What in this version is most likely to regress production?",
      },
      {
        agent: "build",
        name: "Build",
        action: "build",
        requiresApproval: false,
        instruction: "Plan the versioned artifacts. Do not execute a shell.",
      },
      {
        agent: "release-risk",
        name: "Deployment Risk Analysis",
        action: "audit",
        requiresApproval: true,
        instruction: "Human gate before deploy. Score blast radius and name the rollback.",
      },
      {
        agent: "deployment",
        name: "Deploy",
        action: "deploy",
        requiresApproval: false,
        instruction: "Propose a bounded production deploy of the approved version. Health checks required.",
      },
      {
        agent: "monitoring",
        name: "Monitor",
        action: "monitor",
        requiresApproval: false,
        instruction: "Watch error rate and p99 for the new version window.",
      },
      {
        agent: "recovery",
        name: "Post-release Verification",
        action: "verify",
        requiresApproval: false,
        instruction: "Do not close the release on a single green sample.",
      },
    ],
  },
];

export const INTENT_EXAMPLES = [
  {
    id: "release-240",
    label: "Prepare release 2.4.0",
    intent: "Prepare release 2.4.0",
  },
  {
    id: "ship-next",
    label: "Ship v15.1.0",
    intent: "Ship v15.1.0 of the linked Next.js canary",
  },
  {
    id: "hotfix",
    label: "Hotfix checkout 5xx",
    intent: "Hotfix SEV-1: checkout 5xx after canary.20",
  },
];

export type EngineeringIntent = {
  id: "release" | "hotfix";
  playbookName: string;
  version: string | null;
  title: string;
  description: string;
  confidence: number;
};

export function extractReleaseVersion(text: string) {
  const labeled = text.match(
    /(?:release|version|ver)\s+v?(\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?)/i,
  );
  if (labeled?.[1]) return labeled[1];
  const triple = text.match(/\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/);
  if (triple?.[1]) return triple[1].replace(/^v/i, "");
  const pair = text.match(/\bv?(\d+\.\d+)\b/);
  if (pair?.[1]) return pair[1].replace(/^v/i, "");
  return null;
}

export function parseEngineeringIntent(raw: string): EngineeringIntent | null {
  const text = raw.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (
    /\bhotfix\b|\bsev-\d\b|production alert|error rate|error-budget|\b5xx\b/.test(
      lower,
    )
  ) {
    return {
      id: "hotfix",
      playbookName: "Production alert",
      version: extractReleaseVersion(text),
      title: text.length <= 90 ? text : `Hotfix: ${text.slice(0, 70).trim()}…`,
      description: `Autonomous Engineering expanded this intent into the Production alert playbook. The developer did not pick specialists.\n\n${text}`,
      confidence: 0.86,
    };
  }

  if (/\brelease\b|\bship\b|\bcut\b/.test(lower) || extractReleaseVersion(text)) {
    const version = extractReleaseVersion(text) || "next";
    const title = /\bprepare\b/i.test(text)
      ? text.length <= 90
        ? text
        : `Prepare release ${version}`
      : `Prepare release ${version}`;
    return {
      id: "release",
      playbookName: "Release",
      version,
      title,
      description: `Autonomous Engineering expanded “${text}” into the Release workflow for version ${version}.

The developer did not assign specialists. Command Center will:

1. Analyze changes
2. Generate release notes
3. Architecture review
4. Code review
5. Security scan
6. Test suite
7. Regression analysis
8. Build
9. Deployment risk analysis
10. Human approval
11. Deploy
12. Monitor
13. Post-release verification

Operator intent:
${text}`,
      confidence: 0.94,
    };
  }

  return null;
}
