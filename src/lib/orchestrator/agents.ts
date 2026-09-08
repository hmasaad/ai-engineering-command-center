import type { Agent, Project, Task } from "@prisma/client";
import type {
  GithubMeta,
  IssueDetail,
  PullRequestDetail,
} from "@/lib/constants";
import { db } from "@/lib/db";
import {
  fetchIssue,
  fetchPullRequest,
  parseFocusNumber,
} from "@/lib/github";
import {
  TOOLS,
  scanMcpTool,
  scanUntrustedText,
} from "@/lib/security";
import { extractReleaseVersion } from "@/lib/autonomous";
import { parseJson, truncate } from "@/lib/utils";

export type RunContext = {
  agent: Agent;
  action: string;
  instruction?: string | null;
  project: Project;
  task: Task & { focusKind?: string | null; focusRef?: string | null };
  priorOutputs: Array<{ agent: string; output: string }>;
  github: GithubMeta | null;
  pullRequest?: PullRequestDetail | null;
  issue?: IssueDetail | null;
};

function header(ctx: RunContext, title: string) {
  const repo = ctx.project.githubUrl
    ? `${ctx.project.githubOwner}/${ctx.project.githubRepo}`
    : "unlinked";
  const branch = ctx.project.defaultBranch || "main";
  const extras = ctx.instruction
    ? `\nOperator instruction: ${ctx.instruction}`
    : "";
  const focus =
    ctx.task.focusKind && ctx.task.focusRef
      ? `\n**Focus:** ${ctx.task.focusKind} ${ctx.task.focusRef}`
      : "";

  const lane =
    ctx.agent.domain === "security"
      ? "Security"
      : ctx.agent.domain === "operations"
        ? "Operations"
        : ctx.agent.domain === "autonomous"
          ? "Autonomous Engineering"
          : "Development Intelligence";

  return `# ${title}

**Service:** ${ctx.agent.name} · ${lane}
**Action:** ${ctx.action}
**Project:** ${ctx.project.name} · ${repo}@${branch}
**Task:** ${ctx.task.title}
**Type / priority:** ${ctx.task.type} / ${ctx.task.priority}${focus}

${ctx.task.description.trim()}${extras}
`;
}

function prior(ctx: RunContext) {
  if (ctx.priorOutputs.length === 0) {
    return "No upstream specialist output yet — this is the first step in the workflow.";
  }
  return ctx.priorOutputs
    .map(
      (item) =>
        `### From ${item.agent}\n${truncate(item.output.replace(/^# .+\n/, ""), 420)}`,
    )
    .join("\n\n");
}

function githubSnapshot(ctx: RunContext) {
  const meta = ctx.github;
  if (!meta) {
    return "No GitHub snapshot on this project. Link a repository to give this service live PRs, issues, and commits.";
  }
  const prs = (meta.pullRequests || [])
    .slice(0, 5)
    .map((pr) => `#${pr.number} ${pr.title} (@${pr.user})`)
    .join("\n") || "None open";
  const issues = (meta.issues || [])
    .slice(0, 5)
    .map((issue) => `#${issue.number} ${issue.title}`)
    .join("\n") || "None open";
  const commits = (meta.commits || [])
    .slice(0, 4)
    .map((commit) => `${commit.sha} ${commit.message}`)
    .join("\n") || "None returned";
  return `**${meta.fullName}** · ${meta.language || "n/a"} · default ${meta.defaultBranch}

Open PRs:
${prs}

Open issues:
${issues}

Recent commits:
${commits}`;
}

function prBlock(ctx: RunContext) {
  if (!ctx.pullRequest) {
    return "No specific pull request was attached. Using repository snapshot only.";
  }
  const pr = ctx.pullRequest;
  const files = pr.files
    .slice(0, 12)
    .map(
      (file) =>
        `- \`${file.filename}\` (${file.status}, +${file.additions}/-${file.deletions})`,
    )
    .join("\n");
  return `**PR #${pr.number}** ${pr.title}
${pr.url}
Author @${pr.user} · ${pr.state} · ${pr.head} → ${pr.base}

${truncate(pr.body || "No PR body.", 500)}

Files:
${files || "No files returned."}`;
}

function issueBlock(ctx: RunContext) {
  if (!ctx.issue) {
    return "No specific GitHub issue was attached.";
  }
  const issue = ctx.issue;
  return `**Issue #${issue.number}** ${issue.title}
${issue.url}
@${issue.user} · ${issue.state} · labels: ${issue.labels.join(", ") || "none"}

${truncate(issue.body || "No issue body.", 500)}`;
}

function footer(ctx: RunContext) {
  const lane =
    ctx.agent.domain === "security"
      ? "Security"
      : ctx.agent.domain === "operations"
        ? "Operations"
        : ctx.agent.domain === "autonomous"
          ? "Autonomous Engineering"
          : "Development Intelligence";
  return `
---
_${ctx.agent.name} · ${lane} · Command Center orchestrator_
`;
}

function untrustedBlob(ctx: RunContext) {
  return [
    ctx.task.title,
    ctx.task.description,
    ctx.instruction || "",
    ctx.issue?.body || "",
    ctx.pullRequest?.body || "",
    ...ctx.priorOutputs.map((item) => item.output),
  ].join("\n");
}

function hitsBlock(hits: ReturnType<typeof scanUntrustedText>) {
  if (hits.length === 0) {
    return "No detector hits on the untrusted input in this pass.";
  }
  return hits
    .map((hit) => `- **${hit.name}** (+${hit.score}) — ${hit.detail}`)
    .join("\n");
}

function architect(ctx: RunContext) {
  return `${header(ctx, "Technical plan")}
## Repository snapshot
${githubSnapshot(ctx)}

## Upstream context
${prior(ctx)}

## Approach
1. Bound the change to ${ctx.project.name}'s existing module boundaries so the rest of the system stays stable.
2. Introduce the smallest interface that satisfies “${ctx.task.title}”, preferring an additive path over a rewrite.
3. Call out migration, observability, and rollback before implementation starts.

## System impact
- **Code:** Likely touches the primary service path${ctx.project.githubRepo ? ` in \`${ctx.project.githubRepo}\`` : ""}.
- **GitHub:** ${ctx.github?.pullRequests?.length || 0} open PRs, ${ctx.github?.issues?.length || 0} open issues in the last sync.
- **Risk:** ${ctx.task.priority === "critical" || ctx.task.priority === "high" ? "Elevated — keep the blast radius tight and require a human gate before merge." : "Moderate — standard review and tests are sufficient."}

## Recommendation
Approve this plan to release the AI Developer service. Reject to send the task back with a tighter brief.
${footer(ctx)}`;
}

function developer(ctx: RunContext) {
  return `${header(ctx, "Implementation brief")}
## Upstream context
${prior(ctx)}

## Intended change
Implement “${ctx.task.title}” against ${ctx.project.name}${
    ctx.project.githubUrl
      ? ` (${ctx.project.githubOwner}/${ctx.project.githubRepo})`
      : ""
  }.

## Work plan
1. Reproduce the current behavior and lock a failing check if this is a ${ctx.task.type}.
2. Apply the change in a single vertical slice: interface → core logic → wiring.
3. Keep logging and error paths explicit so PR Reviewer and Test Generation can verify without guesswork.
4. Leave a rollback note (feature flag, revert commit, or config switch).

## Handoff
Ready for the next Development Intelligence service in this workflow. Do not merge until the human gate clears.
${footer(ctx)}`;
}

function qa(ctx: RunContext) {
  return `${header(ctx, "Verification plan")}
## Upstream context
${prior(ctx)}

## Test charter
Prove that “${ctx.task.title}” works in ${ctx.project.name} and that adjacent flows did not regress.

## Cases
| Case | Setup | Expected |
| --- | --- | --- |
| Happy path | Perform the new ${ctx.task.type} flow end to end | Outcome matches the task brief |
| Empty / missing input | Submit without required context | Clear error, no partial write |
| Authorization | Repeat as a user without access | Denied, audited |
| Regression | Replay the previous primary flow | Unchanged behavior |

## Verdict
${ctx.task.priority === "critical" ? "Hold release until the critical cases pass." : "Pass if happy path + one failure path are green."}
${footer(ctx)}`;
}

function reviewer(ctx: RunContext) {
  return `${header(ctx, "Review findings")}
## Upstream context
${prior(ctx)}

## Review lens
Correctness, blast radius, operability, and whether this is safe to continue in the workflow.

## Findings
1. **Scope** — The change is framed as “${ctx.task.title}”. Confirm it does not silently expand into unrelated refactors.
2. **Safety** — ${ctx.task.type === "incident" || ctx.task.type === "security" ? "Sensitive path; require a human gate before production impact." : "Standard path; keep the reviewer gate before merge."}
3. **Observability** — Execution history in Command Center remains the source of truth for what ran.

## Gate
- Approve: continue to the next specialist.
- Reject: stop the execution and return comments to the operator.
${footer(ctx)}`;
}

function prReviewer(ctx: RunContext) {
  return `${header(ctx, "PR review")}
## Pull request
${prBlock(ctx)}

## Repository snapshot
${githubSnapshot(ctx)}

## Upstream context
${prior(ctx)}

## Findings
1. **Intent** — Does the PR actually deliver “${ctx.task.title}”? ${ctx.pullRequest ? "Tied to a live GitHub PR; judge the file list against the task." : "No PR number was supplied — treat this as a pre-review of the intended change."}
2. **Blast radius** — ${ctx.pullRequest && ctx.pullRequest.files.length > 10 ? "Wide file set. Ask for a split or a stronger test lock." : "File set looks bounded enough for a single review pass."}
3. **Tests** — Confirm Test Generation or CI covers the new branch and one failure path.
4. **Secrets / config** — Reject if tokens, dotenv files, or generated lock noise landed in the diff.

## Verdict
${ctx.pullRequest?.state === "draft" ? "Request changes — draft PRs should not pass the Command Center merge gate." : "Approve only if the file list matches the task and residual risk is named. Otherwise request changes."}
${footer(ctx)}`;
}

function bugInvestigation(ctx: RunContext) {
  return `${header(ctx, "Bug investigation")}
## Linked issue
${issueBlock(ctx)}

## Repository snapshot
${githubSnapshot(ctx)}

## Upstream context
${prior(ctx)}

## Facts
- Symptom: ${truncate(ctx.task.description, 280)}
- ${ctx.issue ? `GitHub issue #${ctx.issue.number} is the system of record for this bug.` : "No GitHub issue number attached — investigation is based on the task brief and recent commits."}

## Hypotheses (ranked)
1. Recent change on ${ctx.project.defaultBranch || "main"} interacted badly with “${ctx.task.title}”.
2. Missing validation on an input path the happy-path tests never hit.
3. Environment or fixture drift (less likely unless Test Failure Analyzer already flagged flake).

## Repro
1. Start from the linked repo default branch.
2. Perform the failing operator action described in the task.
3. Capture the error, request id, and last deploy SHA.

## Fix brief for AI Developer
Patch the smallest failing path. Do not refactor around the bug. Hand a regression case to Test Generation.
${footer(ctx)}`;
}

function testGeneration(ctx: RunContext) {
  return `${header(ctx, "Generated tests")}
## Upstream context
${prior(ctx)}

## Target
Lock behavior for “${ctx.task.title}” in ${ctx.project.name}.

## Cases to add
1. **Happy path** — operator completes the new flow; assert the persisted result and UI/API contract.
2. **Invalid input** — empty or malformed ${ctx.task.focusKind === "test" ? ctx.task.focusRef : "payload"}; assert 4xx and no write.
3. **AuthZ** — user without permission; assert deny.
4. **Regression** — the previous primary flow still passes.

## Suggested names
- \`${slugTest(ctx.task.title)}_succeeds\`
- \`${slugTest(ctx.task.title)}_rejects_invalid_input\`
- \`${slugTest(ctx.task.title)}_denies_unauthorized\`

## Notes
These are Command Center-generated cases, not an auto-commit into GitHub. AI Developer should land them in the same slice as the fix.
${footer(ctx)}`;
}

function testFailure(ctx: RunContext) {
  const signal = ctx.task.focusRef || ctx.task.title;
  return `${header(ctx, "Test failure analysis")}
## Failure signal
${signal}

## Repository snapshot
${githubSnapshot(ctx)}

## Upstream context
${prior(ctx)}

## Classification
| Signal | Likely class | Next action |
| --- | --- | --- |
| New assertion vs old code | Regression | AI Developer patches product code |
| Same assertion, flaky timing | Flake | Quarantine + retry policy, do not “fix” product |
| Missing fixture / env | Environment | Restore secrets/config; do not merge a skip |

## Working theory
Treat this as a **regression** until proven otherwise. The task “${ctx.task.title}” is the suspected change. Recent commits on ${ctx.github?.defaultBranch || "the default branch"} are the first bisect window.

## Next
1. Re-run the named test once locally.
2. If red, hand a contained patch to AI Developer.
3. If green on retry with no code change, mark flake and keep the test — do not delete it.
${footer(ctx)}`;
}

function refactoring(ctx: RunContext) {
  return `${header(ctx, "Refactoring plan")}
## Upstream context
${prior(ctx)}

## Constraint
Behavior must stay frozen. “${ctx.task.title}” is a structure change, not a feature.

## Proposed moves
1. Extract the core of the affected flow behind a named function/module.
2. Keep public interfaces stable${ctx.project.githubRepo ? ` in \`${ctx.project.githubRepo}\`` : ""}.
3. Delete the leftover path only after Test Generation is green.

## Files (expected)
- The module named in the task brief
- Its nearest test file
- One call-site update, not a repo-wide rename

## Verification
Run the generated happy-path + regression cases. PR Reviewer should reject any diff that changes user-visible output.
${footer(ctx)}`;
}

function techDebt(ctx: RunContext) {
  return `${header(ctx, "Technical debt inventory")}
## Repository snapshot
${githubSnapshot(ctx)}

## Upstream context
${prior(ctx)}

## Inventory (from this Command Center pass)
1. **Hot path complexity** around “${ctx.task.title}” — high cost if every feature keeps patching around it.
2. **Missing characterization tests** — ${ctx.github?.language || "the primary language"} suite likely does not lock the behavior this task cares about.
3. **Open PR load** — ${ctx.github?.pullRequests?.length || 0} open PRs; debt work should not land on top of a crowded merge queue without a freeze.

## Ranked next
| Item | Cost | Risk if ignored | Do now? |
| --- | --- | --- | --- |
| Characterization tests for the named flow | Low | High | Yes |
| Extract module for the hot path | Medium | Medium | After Architect bounds it |
| Broad rename / rewrite | High | High | No |

## Recommendation
Pay down the test gap first, then a bounded refactor. Do not open a rewrite playbook from this inventory.
${footer(ctx)}`;
}

function documentation(ctx: RunContext) {
  return `${header(ctx, "Documentation draft")}
## Upstream context
${prior(ctx)}

## Operator notes
**What changed:** ${ctx.task.title}
**Where:** ${ctx.project.name}${ctx.project.githubUrl ? ` (${ctx.project.githubOwner}/${ctx.project.githubRepo})` : ""}
**How to verify:** Follow the Test Generation happy path. If it fails, open Bug Investigation rather than editing docs.

## README delta (draft)
- Add a short subsection describing the new operator flow for “${ctx.task.title}”.
- Link the GitHub default branch (\`${ctx.project.defaultBranch || "main"}\`) as the source of truth.
- Do not document internal Command Center execution IDs.

## Runbook fragment
1. If the new flow errors, capture SHA + request.
2. Check History in Command Center for the last Development Intelligence run.
3. Page the owning team only after the artifact shows a real regression, not a docs typo.
${footer(ctx)}`;
}

function suspectCommits(ctx: RunContext) {
  const commits = ctx.github?.commits || [];
  if (commits.length === 0) {
    return "No recent commits in the GitHub snapshot. Link a repo or sync to rank a suspect change.";
  }
  return commits
    .slice(0, 5)
    .map(
      (commit, index) =>
        `${index + 1}. \`${commit.sha}\` ${commit.message} (@${commit.author})`,
    )
    .join("\n");
}

function incident(ctx: RunContext) {
  return `${header(ctx, "Incident brief")}
## Upstream context
${prior(ctx)}

## Severity
${ctx.task.priority === "critical" ? "SEV-1 / critical" : ctx.task.priority === "high" ? "SEV-2 / high" : "SEV-3 / elevated"}

## Symptoms
${ctx.task.description}

## Immediate actions
1. Stabilize: contain customer impact.
2. Snapshot current error, deploy, and recent GitHub activity${ctx.project.githubUrl ? ` on ${ctx.project.githubOwner}/${ctx.project.githubRepo}` : ""}.
3. Mitigate: feature-flag, rollback, or traffic shift — do not wait for a perfect RCA.
4. Hand Log Analysis and Root Cause Analysis the window. Bug Investigation + AI Developer follow.

## Handoff
Production-alert playbook continues. Do not declare recovery from this step.
${footer(ctx)}`;
}

function monitoring(ctx: RunContext) {
  const sev =
    ctx.task.priority === "critical"
      ? "error-budget burning; page now"
      : ctx.task.priority === "high"
        ? "SLO miss in progress"
        : "elevated, still inside a recoverable window";
  return `${header(ctx, "Production alert")}
## Signal
${truncate(ctx.task.description, 500)}

## Impact
- **Service:** ${ctx.project.name}${ctx.project.githubUrl ? ` (${ctx.project.githubOwner}/${ctx.project.githubRepo})` : ""}
- **Window:** last 15–30 minutes unless the brief says otherwise
- **Budget:** ${sev}

## Watch
1. Error rate vs SLO
2. p99 on the named path
3. Deploy marker (see Deployment Agent)

## Next
Open the incident. Incident Response Agent contains. This step does not apply a deploy.
${footer(ctx)}`;
}

function logAnalysis(ctx: RunContext) {
  return `${header(ctx, "Log analysis")}
## Upstream context
${prior(ctx)}

## Facts from the window
- Symptom: ${truncate(ctx.task.description, 280)}
- Linked repo: ${ctx.project.githubUrl ? `${ctx.project.githubOwner}/${ctx.project.githubRepo}@${ctx.project.defaultBranch || "main"}` : "unlinked — treat logs as operator-pasted"}

## Cluster (synthetic from this Command Center pass)
1. **Failing path** — the flow named in the alert (checkout / app-render / API edge).
2. **First seen** — aligns with the most recent deploy or flag change until proven otherwise.
3. **Request ids** — capture 3 samples before the next specialist runs.

## Not facts
Do not invent stack frames that are not in the brief. Root Cause Analysis ranks commits; this step only bounds the log window.
${footer(ctx)}`;
}

function rootCause(ctx: RunContext) {
  const top = ctx.github?.commits?.[0];
  return `${header(ctx, "Root cause analysis")}
## Repository snapshot
${githubSnapshot(ctx)}

## Upstream context
${prior(ctx)}

## Suspect commits (ranked)
${suspectCommits(ctx)}

## Working theory
${top ? `Treat \`${top.sha}\` (“${top.message}”) as the first bisect candidate against the log window.` : "No SHA to pin. Bisect from the last known-good deploy marker."}

## Recommendation
1. Bug Investigation confirms the failing path.
2. Prefer a forward-fix if the blast radius is one module; Rollback Agent if the change is a wide deploy.
3. Do not revert from this step — that is Rollback or a human.
${footer(ctx)}`;
}

function deployment(ctx: RunContext) {
  const applying = ctx.action === "deploy";
  return `${header(ctx, applying ? "Deploy plan" : "Live deployment")}
## Upstream context
${prior(ctx)}

## What is live
- Project: ${ctx.project.name}
- Revision marker: ${ctx.project.defaultBranch || "main"}${ctx.github?.commits?.[0] ? ` @ \`${ctx.github.commits[0].sha}\` ${ctx.github.commits[0].message}` : " (no SHA in snapshot)"}
- GitHub: ${ctx.project.githubUrl ? `${ctx.project.githubOwner}/${ctx.project.githubRepo}` : "unlinked"}

${applying
    ? `## Apply (after the human gate)
1. Ship the AI Developer slice only — no extra refactors.
2. Health checks: error rate, p99, and the QA happy path.
3. If the watch window goes red, hand Rollback Agent the last known-good SHA.
4. This Command Center step records a deploy *plan*. It does not SSH or kubectl.`
    : `## Inspect only
No new revision from this step. Compare this SHA to the alert start time. If they line up, Root Cause Analysis should rank that commit first.`}
${footer(ctx)}`;
}

function rollbackAgent(ctx: RunContext) {
  const good = ctx.github?.commits?.[1] || ctx.github?.commits?.[0];
  return `${header(ctx, "Rollback plan")}
## Upstream context
${prior(ctx)}

## Last known-good
${good ? `\`${good.sha}\` ${good.message} (@${good.author})` : "Operator must name the last green deploy; GitHub snapshot is empty."}

## Plan
1. Revert production to that revision (or shift traffic off the canary).
2. Do not forward-fix in the same change.
3. Monitoring watches error rate for 15 minutes.
4. Recovery closes only after the budget stops burning.

Human gate required. Gateway still evaluates \`rollback.apply\`.
${footer(ctx)}`;
}

function performance(ctx: RunContext) {
  return `${header(ctx, "Performance analysis")}
## Upstream context
${prior(ctx)}

## Signals
- Brief: ${truncate(ctx.task.description, 320)}
- Repo language: ${ctx.github?.language || "n/a"}

## Read
| Signal | Reading | vs budget |
| --- | --- | --- |
| p99 | Elevated on the named path | Miss unless the brief says otherwise |
| Error rate | ${ctx.task.priority === "critical" ? "Also burning budget" : "May still be in SLO"} | Separate from latency |
| Saturation | Likely the hot module from recent commits | Confirm with Log Analysis |

## Next
If this is a new regression, Root Cause Analysis ranks commits. If chronic, do not open Production alert — open Performance regression.
${footer(ctx)}`;
}

function recovery(ctx: RunContext) {
  return `${header(ctx, "Recovery verification")}
## Upstream context
${prior(ctx)}

## Close criteria
1. Error rate back inside SLO for a full watch window (not one sample).
2. Deploy/rollback health checks green.
3. No new 5xx cluster in Log Analysis.

## Verdict
${ctx.task.priority === "critical" ? "Keep the window open until Monitoring agrees twice." : "Close if Monitoring and the last deploy/rollback agree."}

Do not reopen Development Intelligence from a green recovery. File a follow-up task if the root cause still needs a durable fix.
${footer(ctx)}`;
}

function security(ctx: RunContext) {
  const hits = scanUntrustedText(untrustedBlob(ctx));
  return `${header(ctx, "Security review")}
## Upstream context
${prior(ctx)}

## Threat model
- **Asset:** ${ctx.project.name}${ctx.project.githubUrl ? ` (${ctx.project.githubOwner}/${ctx.project.githubRepo})` : ""}
- **Change:** ${ctx.task.title}
- **Trust:** Task input, GitHub bodies, and retrieved text are untrusted. The Agent Security Gateway is on the path for every tool request.

## Checks
- AuthZ on every new write path
- Secrets stay out of logs, prompts, and execution artifacts
- MCP servers are deny-by-default
- GitHub tokens are not echoed into Command Center history

## Detector preview (same scanners the gateway uses)
${hitsBlock(hits)}

## Recommendation
${hits.length || ctx.task.priority === "critical" || ctx.task.type === "security" ? "Keep the gateway in-line. Require a human before any side-effecting tool (patch, MCP, shell, secrets)." : "Continue, with the gateway recording an allow and PR Reviewer as a second set of eyes."}
${footer(ctx)}`;
}

function promptInjection(ctx: RunContext) {
  const hits = scanUntrustedText(untrustedBlob(ctx)).filter((hit) => hit.id === "prompt_injection");
  const others = scanUntrustedText(untrustedBlob(ctx)).filter((hit) => hit.id !== "prompt_injection");
  return `${header(ctx, "Prompt injection scan")}
## Untrusted input
${truncate(ctx.task.description, 600)}

## Hits
${hitsBlock(hits)}

## Adjacent signals
${others.length ? hitsBlock(others) : "None."}

## Disposition
${hits.length ? "Treat the brief as hostile. The gateway should not obey injected instructions. Specialist output below is analysis, not compliance." : "No classic injection patterns. Still do not promote this text into a system prompt."}

The Agent Security Gateway already saw this input on preflight. This service exists so operators can run the detector on demand — it is not a separate product.
${footer(ctx)}`;
}

function agentHijacking(ctx: RunContext) {
  const hits = scanUntrustedText(untrustedBlob(ctx)).filter((hit) => hit.id === "agent_hijacking");
  return `${header(ctx, "Agent hijack scan")}
## Registered role
This run is bound to **${ctx.agent.name}** (\`${ctx.agent.role}\`). The registry, not the task brief, decides who acts.

## Hits
${hitsBlock(hits)}

## What would count as a hijack
- Forget / swap role
- Disable the gateway or skip human approval
- “You are now the Developer / root”
- Override the system prompt

## Disposition
${hits.length ? "Hijack language present. Do not change the executing agent. Threat Response should contain if a side-effecting tool was also requested." : "No role-swap language. Keep the gateway in front of the next tool request anyway."}
${footer(ctx)}`;
}

function ragPoisoning(ctx: RunContext) {
  const hits = scanUntrustedText(untrustedBlob(ctx)).filter((hit) => hit.id === "rag_poisoning");
  return `${header(ctx, "RAG poisoning scan")}
## Corpus under review
${ctx.issue ? issueBlock(ctx) : ctx.pullRequest ? prBlock(ctx) : "No GitHub document attached. Scanning the task brief as if it were retrieved context."}

## Hits
${hitsBlock(hits)}

## Rule
Retrieved text is **data**. It is never a new system prompt, never an operator, and never allowed to disable the gateway.

## Disposition
${hits.length ? "Poisoning markers present. Do not write this corpus into memory. Require a human before web.fetch / memory.write." : "No hidden-instruction markers in this pass. Still isolate untrusted corpus from the system prompt."}
${footer(ctx)}`;
}

function mcpSecurity(ctx: RunContext) {
  const text = untrustedBlob(ctx);
  const hits = scanMcpTool("mcp.call", /shell|exec|filesystem/i.test(text) ? "tools/call:shell.exec" : "tools/list", text);
  return `${header(ctx, "MCP security review")}
## Assumption
MCP servers are untrusted until an operator allow-lists them. \`tools/list\` is inspection; \`tools/call\` on filesystem/shell/secrets is a deny.

## Hits
${hitsBlock(hits)}

## Controls
1. Only mcp-security may inspect MCP without a human (see Tool Permission Manager).
2. \`shell.exec\` and \`secrets.read\` stay denied even if an MCP server wraps them.
3. Sampling / unconstrained HTTP is egress — treat like exfil.

## Disposition
${hits.some((hit) => /filesystem|shell|secrets|HTTP/i.test(hit.detail)) ? "Dangerous MCP method. Gateway should deny or hold. Do not invoke." : "Inspection-only MCP. Record the server; do not expand its tool set from this brief."}
${footer(ctx)}`;
}

function dataExfiltration(ctx: RunContext) {
  const hits = scanUntrustedText(untrustedBlob(ctx)).filter((hit) => hit.id === "data_exfiltration");
  return `${header(ctx, "Exfiltration scan")}
## Hits
${hitsBlock(hits)}

## Sinks to watch
webhook.site, pastebin, ngrok, Discord webhooks, raw \`GITHUB_TOKEN\` / \`.env\` / private keys in artifacts.

## Disposition
${hits.length ? "Exfil signal present. Do not copy secret values into this artifact. Gateway should deny \`secrets.read\` and \`shell.exec\`. Rotate any named credential offline." : "No classic exfil sinks in this brief. Still redact tokens if they appear in a later artifact."}

This service reports; it does not load secrets.
${footer(ctx)}`;
}

async function toolPermissions(ctx: RunContext) {
  const rows = await db.toolPermission.findMany({ orderBy: [{ toolName: "asc" }, { agentSlug: "asc" }] });
  const list = (rows.length ? rows : []).map(
    (row) =>
      `| \`${row.toolName}\` | ${row.agentSlug} | **${row.mode}** | ${row.note || ""} |`,
  );
  const fallback = TOOLS.map((tool) => `| \`${tool.name}\` | * | allow/deny per seed | ${tool.description} |`);
  return `${header(ctx, "Tool permission table")}
The Agent Security Gateway reads this table on every tool request.

| Tool | Agent | Mode | Note |
| --- | --- | --- | --- |
${(list.length ? list : fallback).join("\n")}

## Least privilege for this task
“${ctx.task.title}” should not need \`shell.exec\` or \`secrets.read\`. Side-effecting tools stay on require-approval or deny.

Edit live modes under **Security → Permissions**. This service does not silently loosen policy.
${footer(ctx)}`;
}

async function securityGateway(ctx: RunContext) {
  const events = await db.gatewayEvent.findMany({
    where: { execution: { projectId: ctx.project.id } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { agent: true, execution: { include: { task: true } } },
  });
  const lines =
    events.length === 0
      ? "- No gateway events on this project yet. The next specialist step will create one."
      : events
          .map(
            (event) =>
              `- **${event.verdict}** risk ${event.riskScore} · ${event.agent.name} · \`${event.toolName}\` · ${event.phase} · ${event.execution.task.title}`,
          )
          .join("\n");
  return `${header(ctx, "Gateway audit")}
Every agent action already passed through:

\`Agent → Tool request → Security Gateway → Policy evaluation → Risk score → Allow | Deny | Human\`

## Recent decisions on ${ctx.project.name}
${lines}

## This task
The preflight event for this very step is in History. This service does not bypass the gateway; it reports on it.
${footer(ctx)}`;
}

function threatResponse(ctx: RunContext) {
  const hits = scanUntrustedText(untrustedBlob(ctx));
  const high = hits.length > 0 || ctx.task.priority === "critical";
  return `${header(ctx, "Threat response")}
## Situation
${high ? "Hostile or high-priority signal. Contain before any other specialist continues." : "No active detector hits. Still treat this as a drill: isolate, notify, recommend."}

## Hits
${hitsBlock(hits)}

## Containment
1. Leave the original tool request **denied or held**. Do not retry it from this step.
2. Keep \`shell.exec\` and \`secrets.read\` denied.
3. Notify the operator via the approval queue (this step is a human gate).
4. If credentials were named, rotate them outside Command Center. Do not paste values here.

## Follow-up
- Tighten Tool Permission Manager if a new tool was requested.
- Re-run Prompt Injection / Hijack on the same brief after editing.
- Only then return to Development Intelligence.
${footer(ctx)}`;
}

function releaseVersion(ctx: RunContext) {
  return (
    extractReleaseVersion(`${ctx.task.title}\n${ctx.task.description}`) || "next"
  );
}

function releaseAnalyst(ctx: RunContext) {
  const version = releaseVersion(ctx);
  const commits = ctx.github?.commits || [];
  const prs = ctx.github?.pullRequests || [];
  const commitLines =
    commits.length === 0
      ? "- No commits in the GitHub snapshot. Sync the project to analyze a real change set."
      : commits
          .slice(0, 8)
          .map((commit) => `- \`${commit.sha}\` ${commit.message} (@${commit.author})`)
          .join("\n");
  const prLines =
    prs.length === 0
      ? "- No open PRs in the snapshot."
      : prs
          .slice(0, 6)
          .map((pr) => `- #${pr.number} ${pr.title} (@${pr.user})`)
          .join("\n");
  return `${header(ctx, `Change analysis · ${version}`)}
## Repository snapshot
${githubSnapshot(ctx)}

## What landed since the last cut
${commitLines}

## Still open
${prLines}

## Scope for ${version}
1. **Features** — cluster the commit subjects above into the version narrative.
2. **Fixes** — anything that looks like a regression lock.
3. **Risk** — wide file-set PRs and default-branch commits close to deploy.

## Handoff
Release Notes writes the operator-facing changelog. Architecture Review judges whether this is still one version.
${footer(ctx)}`;
}

function releaseNotes(ctx: RunContext) {
  const version = releaseVersion(ctx);
  return `${header(ctx, `Release notes · ${version}`)}
## Upstream context
${prior(ctx)}

## ${ctx.project.name} ${version}

### Highlights
- Ships the change set named in Analyze Changes for **${version}**.
- Bound to ${ctx.project.githubOwner && ctx.project.githubRepo ? `${ctx.project.githubOwner}/${ctx.project.githubRepo}` : "the unlinked project"} @ ${ctx.project.defaultBranch || "main"}.

### Fixes
- Include every commit that reads as a regression lock from the analyst step.

### Breaking / upgrade
- ${ctx.task.priority === "critical" ? "Treat as a high-risk cut. Call out any public API or config flag." : "No breaking change assumed unless Analyze Changes flagged one."}

### Operators
- Rollback: previous revision on ${ctx.project.defaultBranch || "main"}.
- Watch: error rate and p99 for one full window after deploy.

Do not paste secrets into these notes.
${footer(ctx)}`;
}

function buildAgent(ctx: RunContext) {
  const version = releaseVersion(ctx);
  return `${header(ctx, `Build plan · ${version}`)}
## Upstream context
${prior(ctx)}

## Artifacts
- \`${ctx.project.githubRepo || ctx.project.slug || "app"}@${version}\` — version-stamped build
- Source map / SBOM placeholder
- Smoke: health endpoint + one critical user path

## Graph
1. Install / lockfile check (read-only).
2. Typecheck + unit + the Test Suite cases from upstream.
3. Stamp **${version}**.
4. Produce the artifact list. **Do not run \`shell.exec\`.** \`build.plan\` is an artifact, not a compiler.

## Gate
Build is planned. Deployment Risk Analysis still has to score go / no-go. A human still approves before \`deploy.apply\`.
${footer(ctx)}`;
}

function releaseRisk(ctx: RunContext) {
  const version = releaseVersion(ctx);
  const hits = scanUntrustedText(untrustedBlob(ctx));
  const go = hits.length === 0 && ctx.task.priority !== "critical";
  return `${header(ctx, `Deployment risk · ${version}`)}
## Upstream context
${prior(ctx)}

## Detector preview
${hits.length ? hits.map((hit) => `- **${hit.name}** — ${hit.detail}`).join("\n") : "- No hostile markers in the release brief."}

## Blast radius
- Version: **${version}**
- Live inspect: ${ctx.project.githubUrl ? `${ctx.project.githubOwner}/${ctx.project.githubRepo}` : "unlinked"} production
- Rollback: previous revision (do not invent a SHA)

## Score
${go ? "**Go, with a human gate.** Residual risk is named; SLO watch is mandatory after apply." : "**Hold.** Hostile or critical signal. Human must reject or demand a tighter cut before deploy."}

## Human approval
This step is the release gate. Approve to let Deployment Agent apply **${version}**. Reject to halt. The Agent Security Gateway still sits in front of \`deploy.apply\`.
${footer(ctx)}`;
}

function slugTest(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "change";
}

const runners: Record<string, (ctx: RunContext) => string | Promise<string>> = {
  architect,
  developer,
  qa,
  reviewer,
  pr_reviewer: prReviewer,
  bug_investigation: bugInvestigation,
  test_generation: testGeneration,
  test_failure: testFailure,
  refactoring,
  tech_debt: techDebt,
  documentation,
  incident,
  monitoring,
  log_analysis: logAnalysis,
  root_cause: rootCause,
  deployment,
  rollback: rollbackAgent,
  performance,
  recovery,
  security,
  prompt_injection: promptInjection,
  agent_hijacking: agentHijacking,
  rag_poisoning: ragPoisoning,
  mcp_security: mcpSecurity,
  data_exfiltration: dataExfiltration,
  tool_permissions: toolPermissions,
  security_gateway: securityGateway,
  threat_response: threatResponse,
  release_analyst: releaseAnalyst,
  release_notes: releaseNotes,
  build: buildAgent,
  release_risk: releaseRisk,
};

async function resolveFocus(
  project: Project,
  task: Task & { focusKind?: string | null; focusRef?: string | null },
) {
  const github = parseJson<GithubMeta | null>(project.githubMeta, null);
  const kind = task.focusKind || "";
  const number = parseFocusNumber(task.focusRef);
  let pullRequest: PullRequestDetail | null = null;
  let issue: IssueDetail | null = null;

  if (project.githubOwner && project.githubRepo && number) {
    if (kind === "pr" || kind === "review") {
      try {
        pullRequest = await fetchPullRequest(
          project.githubOwner,
          project.githubRepo,
          number,
        );
      } catch {
        pullRequest = null;
      }
    }
    if (kind === "issue" || kind === "bug") {
      try {
        issue = await fetchIssue(
          project.githubOwner,
          project.githubRepo,
          number,
        );
      } catch {
        issue = null;
      }
    }
  }

  return { github, pullRequest, issue };
}

export async function runSpecialist(input: {
  agent: Agent;
  action: string;
  instruction?: string | null;
  project: Project;
  task: Task & { focusKind?: string | null; focusRef?: string | null };
  priorOutputs: Array<{ agent: string; output: string }>;
}) {
  const focus = await resolveFocus(input.project, input.task);
  const ctx: RunContext = {
    ...input,
    github: focus.github,
    pullRequest: focus.pullRequest,
    issue: focus.issue,
  };
  const runner = runners[input.agent.role] ?? architect;
  return (await runner(ctx)).trim();
}
