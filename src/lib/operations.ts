import type { PlaybookDef, ServiceDef } from "@/lib/development";

export const OPERATIONS_SERVICES: ServiceDef[] = [
  {
    slug: "monitoring",
    role: "monitoring",
    name: "Monitoring Agent",
    domain: "operations",
    description:
      "Ingests a production alert, names the SLO/error-budget impact, and opens the incident window.",
    capabilities: ["Alert ingest", "SLO impact", "Error budget", "Watch window"],
    systemPrompt:
      "You are the Monitoring Agent of Command Center Operations. Turn a signal into a bounded incident, not a dashboard tour.",
    defaultAction: "monitor",
    requiresApproval: false,
    taskType: "incident",
  },
  {
    slug: "incident-response",
    role: "incident",
    name: "Incident Response Agent",
    domain: "operations",
    description:
      "Triage and containment. Stabilizes customer impact, snapshots evidence, and hands a fix brief downstream.",
    capabilities: ["Severity rating", "Containment", "Evidence snapshot", "Fix handoff"],
    systemPrompt:
      "You are the Incident Response Agent of Command Center Operations. Contain first. Do not wait for a perfect root cause.",
    defaultAction: "triage",
    requiresApproval: false,
    taskType: "incident",
  },
  {
    slug: "log-analysis",
    role: "log_analysis",
    name: "Log Analysis Agent",
    domain: "operations",
    description:
      "Reads the error, trace, and deploy window and extracts the failing path, request ids, and first/last seen.",
    capabilities: ["Error clustering", "Trace ids", "First/last seen", "Failing path"],
    systemPrompt:
      "You are the Log Analysis Agent of Command Center Operations. Quote log facts. Do not invent stack frames.",
    defaultAction: "analyze",
    requiresApproval: false,
    taskType: "incident",
  },
  {
    slug: "root-cause",
    role: "root_cause",
    name: "Root Cause Analysis Agent",
    domain: "operations",
    description:
      "Ranks suspect commits and config changes against the log window. Points Bug Investigation at one change.",
    capabilities: ["Suspect commits", "Deploy correlation", "Config drift", "Ranked causes"],
    systemPrompt:
      "You are the Root Cause Analysis Agent of Command Center Operations. Rank hypotheses. Name the commit you would revert first.",
    defaultAction: "investigate",
    requiresApproval: false,
    taskType: "incident",
  },
  {
    slug: "deployment",
    role: "deployment",
    name: "Deployment Agent",
    domain: "operations",
    description:
      "Inspects what is live, or (after a human gate) proposes a bounded deploy of the approved fix.",
    capabilities: ["Live revision", "Deploy window", "Release notes", "Health checks"],
    systemPrompt:
      "You are the Deployment Agent of Command Center Operations. Inspect freely. Never apply a deploy until a human has approved the workflow gate.",
    defaultAction: "inspect",
    requiresApproval: false,
    taskType: "incident",
  },
  {
    slug: "rollback",
    role: "rollback",
    name: "Rollback Agent",
    domain: "operations",
    description:
      "Proposes the smallest revert that restores the last known-good revision, with a verification step.",
    capabilities: ["Last known good", "Revert plan", "Traffic shift", "Verify after"],
    systemPrompt:
      "You are the Rollback Agent of Command Center Operations. Prefer revert over forward-fix when the blast radius is unknown.",
    defaultAction: "rollback",
    requiresApproval: true,
    taskType: "incident",
  },
  {
    slug: "performance",
    role: "performance",
    name: "Performance Agent",
    domain: "operations",
    description:
      "Reads latency, saturation, and error-rate signals and names the hot path without a rewrite prescription.",
    capabilities: ["p99/p95", "Saturation", "Hot path", "Budget vs SLO"],
    systemPrompt:
      "You are the Performance Agent of Command Center Operations. Separate a regression from chronic slowness.",
    defaultAction: "analyze",
    requiresApproval: false,
    taskType: "incident",
  },
  {
    slug: "recovery",
    role: "recovery",
    name: "Recovery Agent",
    domain: "operations",
    description:
      "Confirms the incident is over: error rate back in budget, deploy healthy, and the watch window can close.",
    capabilities: ["Error-rate close", "Health checks", "Watch window", "Incident close"],
    systemPrompt:
      "You are the Recovery Agent of Command Center Operations. Do not close the incident on a single green sample.",
    defaultAction: "verify",
    requiresApproval: false,
    taskType: "incident",
  },
];

export const PRODUCTION_ALERT_FLOW: Array<{
  label: string;
  agent: string;
  gate?: boolean;
}> = [
  { label: "Production Alert", agent: "monitoring" },
  { label: "Incident Agent", agent: "incident-response" },
  { label: "Analyze Logs", agent: "log-analysis" },
  { label: "Check Deployment", agent: "deployment" },
  { label: "Find Suspicious Commit", agent: "root-cause" },
  { label: "Bug Investigation", agent: "bug-investigation" },
  { label: "Generate Fix", agent: "developer" },
  { label: "QA", agent: "qa" },
  { label: "Security", agent: "security" },
  { label: "Human Approval", agent: "security", gate: true },
  { label: "Deploy", agent: "deployment" },
  { label: "Monitor", agent: "monitoring" },
  { label: "Verify Resolution", agent: "recovery" },
] ;

export const OPERATIONS_PLAYBOOKS: PlaybookDef[] = [
  {
    name: "Production alert",
    domain: "operations",
    description:
      "Alert → incident → logs → live revision → suspect commit → bug investigation → fix → QA → security gate → deploy → monitor → recovery.",
    steps: [
      {
        agent: "monitoring",
        name: "Ingest production alert",
        action: "monitor",
        requiresApproval: false,
        instruction: "Bound the SLO impact and open the incident window.",
      },
      {
        agent: "incident-response",
        name: "Triage and contain",
        action: "triage",
        requiresApproval: false,
        instruction: "Contain customer impact before a perfect root cause.",
      },
      {
        agent: "log-analysis",
        name: "Analyze logs",
        action: "analyze",
        requiresApproval: false,
      },
      {
        agent: "deployment",
        name: "Check current deployment",
        action: "inspect",
        requiresApproval: false,
        instruction: "Report what is live. Do not apply a new revision.",
      },
      {
        agent: "root-cause",
        name: "Find suspicious commit",
        action: "investigate",
        requiresApproval: false,
        instruction: "Rank recent GitHub commits against the log window.",
      },
      {
        agent: "bug-investigation",
        name: "Investigate the bug",
        action: "investigate",
        requiresApproval: false,
      },
      {
        agent: "developer",
        name: "Generate the fix",
        action: "implement",
        requiresApproval: false,
        instruction: "Smallest patch that matches Root Cause Analysis. Name the rollback.",
      },
      {
        agent: "qa",
        name: "Verify the fix",
        action: "test",
        requiresApproval: false,
      },
      {
        agent: "security",
        name: "Security review",
        action: "audit",
        requiresApproval: true,
        instruction: "Human gate before deploy. The gateway still sits in front of deploy.apply.",
      },
      {
        agent: "deployment",
        name: "Deploy the fix",
        action: "deploy",
        requiresApproval: false,
        instruction: "Propose a bounded deploy of the approved fix. Do not skip health checks.",
      },
      {
        agent: "monitoring",
        name: "Watch the window",
        action: "monitor",
        requiresApproval: false,
      },
      {
        agent: "recovery",
        name: "Verify resolution",
        action: "verify",
        requiresApproval: false,
      },
    ],
  },
  {
    name: "Incident response",
    domain: "operations",
    description:
      "Triage, read logs, apply a contained fix with a human gate, then Recovery closes the window.",
    steps: [
      {
        agent: "incident-response",
        name: "Triage and contain",
        action: "triage",
        requiresApproval: false,
      },
      {
        agent: "log-analysis",
        name: "Analyze logs",
        action: "analyze",
        requiresApproval: false,
      },
      {
        agent: "developer",
        name: "Apply mitigation",
        action: "implement",
        requiresApproval: true,
      },
      {
        agent: "recovery",
        name: "Confirm recovery",
        action: "verify",
        requiresApproval: false,
      },
    ],
  },
  {
    name: "Rollback production",
    domain: "operations",
    description:
      "Incident triages, Rollback proposes last-known-good (human gate), Monitoring watches, Recovery closes.",
    steps: [
      {
        agent: "incident-response",
        name: "Triage blast radius",
        action: "triage",
        requiresApproval: false,
      },
      {
        agent: "rollback",
        name: "Propose rollback",
        action: "rollback",
        requiresApproval: true,
      },
      {
        agent: "monitoring",
        name: "Watch after revert",
        action: "monitor",
        requiresApproval: false,
      },
      {
        agent: "recovery",
        name: "Verify resolution",
        action: "verify",
        requiresApproval: false,
      },
    ],
  },
  {
    name: "Performance regression",
    domain: "operations",
    description:
      "Performance names the hot path, logs and RCA correlate a commit, then a human-gated fix.",
    steps: [
      {
        agent: "performance",
        name: "Profile the regression",
        action: "analyze",
        requiresApproval: false,
      },
      {
        agent: "log-analysis",
        name: "Correlate traces",
        action: "analyze",
        requiresApproval: false,
      },
      {
        agent: "root-cause",
        name: "Rank suspect commits",
        action: "investigate",
        requiresApproval: false,
      },
      {
        agent: "developer",
        name: "Propose a bounded fix",
        action: "implement",
        requiresApproval: true,
      },
    ],
  },
];

export const ALERT_EXAMPLES = [
  {
    id: "5xx",
    label: "5xx after deploy",
    title: "SEV-1: checkout 5xx after canary.20",
    description:
      "Production alert: checkout error rate 12% (SLO 0.5%) starting 14 minutes after vercel/next.js canary deploy. p99 4.8s. Trace ids cluster on the billing path. Last known-good is the previous canary.",
  },
  {
    id: "latency",
    label: "p99 latency",
    title: "SEV-2: app-render p99 above budget",
    description:
      "Monitoring: app-render p99 2.4s vs 800ms budget for 25 minutes. Error rate is in budget. Saturation on the RSC path after recent commits on the default branch.",
  },
  {
    id: "budget",
    label: "Error budget burn",
    title: "Error budget 40% burned in 1h",
    description:
      "Alert: 2xx/5xx mix on the API edge burned 40% of the monthly error budget in 60 minutes. No deploy in the last hour; last change is a config flag. Need logs + suspect commit before a rollback vs forward-fix.",
  },
];
