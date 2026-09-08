export const AGENT_ROLES = [
  { value: "architect", label: "AI Software Architect" },
  { value: "developer", label: "AI Developer" },
  { value: "pr_reviewer", label: "PR Reviewer" },
  { value: "bug_investigation", label: "Bug Investigation" },
  { value: "test_generation", label: "Test Generation" },
  { value: "test_failure", label: "Test Failure Analyzer" },
  { value: "refactoring", label: "Refactoring" },
  { value: "tech_debt", label: "Technical Debt" },
  { value: "documentation", label: "Documentation" },
  { value: "qa", label: "QA" },
  { value: "reviewer", label: "Reviewer" },
  { value: "incident", label: "Incident Response Agent" },
  { value: "monitoring", label: "Monitoring Agent" },
  { value: "log_analysis", label: "Log Analysis Agent" },
  { value: "root_cause", label: "Root Cause Analysis Agent" },
  { value: "deployment", label: "Deployment Agent" },
  { value: "rollback", label: "Rollback Agent" },
  { value: "performance", label: "Performance Agent" },
  { value: "recovery", label: "Recovery Agent" },
  { value: "security", label: "Security Review Agent" },
  { value: "prompt_injection", label: "Prompt Injection Detection" },
  { value: "agent_hijacking", label: "Agent Hijacking Detection" },
  { value: "rag_poisoning", label: "RAG Poisoning Detection" },
  { value: "mcp_security", label: "MCP Security" },
  { value: "data_exfiltration", label: "Data Exfiltration Detection" },
  { value: "tool_permissions", label: "Tool Permission Manager" },
  { value: "security_gateway", label: "Agent Security Gateway" },
  { value: "threat_response", label: "Threat Response Agent" },
  { value: "release_analyst", label: "Release Analyst" },
  { value: "release_notes", label: "Release Notes" },
  { value: "build", label: "Build Agent" },
  { value: "release_risk", label: "Release Risk Agent" },
] as const;

export const TASK_TYPES = [
  { value: "feature", label: "Feature" },
  { value: "bug", label: "Bug" },
  { value: "incident", label: "Incident" },
  { value: "security", label: "Security" },
  { value: "chore", label: "Chore" },
  { value: "review", label: "Review" },
  { value: "refactor", label: "Refactor" },
  { value: "docs", label: "Docs" },
  { value: "release", label: "Release" },
] as const;

export const TASK_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const STEP_ACTIONS = [
  { value: "plan", label: "Plan" },
  { value: "implement", label: "Implement" },
  { value: "review", label: "Review" },
  { value: "test", label: "Test" },
  { value: "triage", label: "Triage" },
  { value: "audit", label: "Audit" },
  { value: "design", label: "Design" },
  { value: "verify", label: "Verify" },
  { value: "investigate", label: "Investigate" },
  { value: "generate", label: "Generate" },
  { value: "analyze", label: "Analyze" },
  { value: "refactor", label: "Refactor" },
  { value: "document", label: "Document" },
  { value: "detect", label: "Detect" },
  { value: "authorize", label: "Authorize" },
  { value: "respond", label: "Respond" },
  { value: "scan", label: "Scan" },
  { value: "monitor", label: "Monitor" },
  { value: "inspect", label: "Inspect" },
  { value: "deploy", label: "Deploy" },
  { value: "rollback", label: "Rollback" },
  { value: "recover", label: "Recover" },
  { value: "build", label: "Build" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  open: "Open",
  pending: "Pending",
  running: "Running",
  in_progress: "In progress",
  awaiting_approval: "Awaiting approval",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  skipped: "Skipped",
  approved: "Approved",
  rejected: "Rejected",
  denied: "Denied by gateway",
  awaiting_gateway: "Gateway hold",
  allowed: "Allowed",
};

export type GithubCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

export type GithubPullRequest = {
  number: number;
  title: string;
  url: string;
  user: string;
  body?: string;
};

export type GithubIssue = {
  number: number;
  title: string;
  url: string;
  user: string;
  labels: string[];
};

export type GithubFileChange = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
};

export type PullRequestDetail = {
  number: number;
  title: string;
  body: string | null;
  url: string;
  user: string;
  state: string;
  base: string;
  head: string;
  files: GithubFileChange[];
};

export type IssueDetail = {
  number: number;
  title: string;
  body: string | null;
  url: string;
  user: string;
  state: string;
  labels: string[];
};

export type GithubMeta = {
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  visibility: string;
  pushedAt: string | null;
  commits: GithubCommit[];
  pullRequests: GithubPullRequest[];
  issues: GithubIssue[];
};
