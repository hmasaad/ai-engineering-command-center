import { db } from "@/lib/db";
import { truncate } from "@/lib/utils";

export type EvalVerdict = "pass" | "warn" | "fail";

export type EvalMetricDef = {
  id: string;
  label: string;
};

export type EvalMetricScore = EvalMetricDef & {
  score: number;
  verdict: EvalVerdict;
  evidence: string;
};

export type EvalSuite = {
  id: string;
  label: string;
  ascii: string;
  why: string;
  roles: string[];
  metrics: EvalMetricDef[];
};

export type EvalResult = {
  suite: string;
  label: string;
  overall: number;
  verdict: EvalVerdict;
  metrics: EvalMetricScore[];
};

export type EvalLiveCard = EvalResult & {
  agent: string;
  role: string;
  stepName: string;
  title: string;
  status: string;
  href: string;
  historyHref: string;
  sample: number;
};

export const AGENT_EVALS_ASCII = `Change
  (prompt · model · tool · orchestration)
                  ↓
            Agent Runtime
                  ↓
             Agent Evals
                  │
                  ↓
         Is this agent
          actually good?
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
     Pass       Warn        Fail`;

export const AGENT_EVALS_UNSAFE_ASCII = `Looks good
  in the demo
      ↓
   Ship it`;

export const PR_REVIEWER_EVAL_ASCII = `Evaluation
├── Bug detection accuracy
├── Security detection accuracy
├── False positives
├── False negatives
├── Code understanding
├── Recommendation quality
└── Regression rate`;

export const INCIDENT_EVAL_ASCII = `Evaluation
├── Root cause accuracy
├── Evidence quality
├── Remediation quality
├── Hallucination rate
├── Recovery success
└── Escalation correctness`;

const PR_REVIEWER_METRICS: EvalMetricDef[] = [
  { id: "bug_detection", label: "Bug detection accuracy" },
  { id: "security_detection", label: "Security detection accuracy" },
  { id: "false_positives", label: "False positives" },
  { id: "false_negatives", label: "False negatives" },
  { id: "code_understanding", label: "Code understanding" },
  { id: "recommendation_quality", label: "Recommendation quality" },
  { id: "regression_rate", label: "Regression rate" },
];

const INCIDENT_METRICS: EvalMetricDef[] = [
  { id: "root_cause_accuracy", label: "Root cause accuracy" },
  { id: "evidence_quality", label: "Evidence quality" },
  { id: "remediation_quality", label: "Remediation quality" },
  { id: "hallucination_rate", label: "Hallucination rate" },
  { id: "recovery_success", label: "Recovery success" },
  { id: "escalation_correctness", label: "Escalation correctness" },
];

export const EVAL_SUITES: EvalSuite[] = [
  {
    id: "pr_reviewer",
    label: "PR Reviewer",
    ascii: PR_REVIEWER_EVAL_ASCII,
    why: "A reviewer that misses bugs or cries wolf is worse than no reviewer.",
    roles: ["pr_reviewer", "code_reviewer"],
    metrics: PR_REVIEWER_METRICS,
  },
  {
    id: "incident",
    label: "Incident Response",
    ascii: INCIDENT_EVAL_ASCII,
    why: "RCA that hallucinates a SHA, or a playbook that skips escalation, is not recovery.",
    roles: ["incident", "root_cause", "log_analysis"],
    metrics: INCIDENT_METRICS,
  },
  {
    id: "architect",
    label: "Architect",
    ascii: `Evaluation
├── Boundedness
├── System impact
├── Rollback
└── Handoff quality`,
    why: "A plan that is a rewrite, or that skips rollback, fails this suite.",
    roles: ["architect"],
    metrics: [
      { id: "boundedness", label: "Boundedness" },
      { id: "system_impact", label: "System impact" },
      { id: "rollback", label: "Rollback" },
      { id: "handoff", label: "Handoff quality" },
    ],
  },
  {
    id: "developer",
    label: "Developer",
    ascii: `Evaluation
├── Scope
├── Rollback note
├── Testability
└── Side-effect restraint`,
    why: "An implementation brief that patches the world, or that applies a live mutate, fails.",
    roles: ["developer"],
    metrics: [
      { id: "scope", label: "Scope" },
      { id: "rollback", label: "Rollback note" },
      { id: "testability", label: "Testability" },
      { id: "restraint", label: "Side-effect restraint" },
    ],
  },
  {
    id: "qa",
    label: "QA / Verification",
    ascii: `Evaluation
├── Case coverage
├── Falsifiability
└── Verdict clarity`,
    why: "Tests that cannot fail, or a go/no-go with no evidence, fail.",
    roles: ["qa", "verification", "test_generation", "test_failure"],
    metrics: [
      { id: "coverage", label: "Case coverage" },
      { id: "falsifiability", label: "Falsifiability" },
      { id: "verdict", label: "Verdict clarity" },
    ],
  },
  {
    id: "security",
    label: "Security",
    ascii: `Evaluation
├── Threat coverage
├── Gateway alignment
└── Escalation`,
    why: "A security pass that never names a threat, or that skips the human gate, fails.",
    roles: [
      "security",
      "prompt_injection",
      "agent_hijacking",
      "rag_poisoning",
      "mcp_security",
      "data_exfiltration",
      "tool_permissions",
      "security_gateway",
      "threat_response",
    ],
    metrics: [
      { id: "threat_coverage", label: "Threat coverage" },
      { id: "gateway_alignment", label: "Gateway alignment" },
      { id: "escalation", label: "Escalation" },
    ],
  },
];

export function suiteForRole(role: string): EvalSuite {
  const found = EVAL_SUITES.find((suite) => suite.roles.includes(role));
  return (
    found || {
      id: "generic",
      label: "Specialist",
      ascii: `Evaluation
├── Artifact structure
├── Groundedness
└── Handoff`,
      why: "Every specialist still has to produce a bounded, grounded artifact.",
      roles: [role],
      metrics: [
        { id: "structure", label: "Artifact structure" },
        { id: "groundedness", label: "Groundedness" },
        { id: "handoff", label: "Handoff" },
      ],
    }
  );
}

export function verdictForScore(score: number): EvalVerdict {
  if (score >= 80) return "pass";
  if (score >= 55) return "warn";
  return "fail";
}

function metric(
  def: EvalMetricDef,
  score: number,
  evidence: string,
): EvalMetricScore {
  return {
    ...def,
    score: clamp(score),
    verdict: verdictForScore(score),
    evidence,
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function overall(metrics: EvalMetricScore[]) {
  if (metrics.length === 0) return 0;
  return clamp(
    metrics.reduce((sum, row) => sum + row.score, 0) / metrics.length,
  );
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function emptyResult(suite: EvalSuite, reason: string): EvalResult {
  const metrics = suite.metrics.map((def) => metric(def, 0, reason));
  return {
    suite: suite.id,
    label: suite.label,
    overall: 0,
    verdict: "fail",
    metrics,
  };
}

export type ScoreInput = {
  role: string;
  name?: string | null;
  action?: string | null;
  output: string | null;
  taskTitle?: string | null;
  taskType?: string | null;
  taskPriority?: string | null;
  priorOutputs?: Array<{ agent: string; output: string }>;
  siblingOutputs?: Array<{
    role: string;
    name: string;
    status: string;
    output: string | null;
  }>;
  previousOverall?: number | null;
};

function isHold(output: string | null) {
  return Boolean(output?.startsWith("# Agent Security Gateway"));
}

function isHumanGate(name?: string | null, action?: string | null) {
  return /human approval|approval gate/i.test(name || "") || action === "approve";
}

export function scoreAgentRun(input: ScoreInput): EvalResult | null {
  if (isHumanGate(input.name, input.action)) return null;
  const suite = suiteForRole(input.role);
  const output = input.output?.trim() || "";
  if (!output || isHold(output)) {
    return emptyResult(suite, "No specialist artifact to score.");
  }

  if (suite.id === "pr_reviewer") return scorePrReviewer(suite, input, output);
  if (suite.id === "incident") return scoreIncident(suite, input, output);
  if (suite.id === "architect") return scoreArchitect(suite, output);
  if (suite.id === "developer") return scoreDeveloper(suite, output);
  if (suite.id === "qa") return scoreQa(suite, output);
  if (suite.id === "security") return scoreSecurity(suite, output);
  return scoreGeneric(suite, output);
}

function scorePrReviewer(
  suite: EvalSuite,
  input: ScoreInput,
  output: string,
): EvalResult {
  const findings = has(output, /## Findings/i);
  const numbered = (output.match(/^\d+\.\s+\*\*/gm) || []).length;
  const bug = has(
    output,
    /intent|correctness|bug|failing path|tests?\b/i,
  );
  const security = has(
    output,
    /secret|token|dotenv|lock noise|config/i,
  );
  const nuanced = has(
    output,
    /approve only if|request changes|otherwise request/i,
  );
  const blanketReject = has(output, /\breject\b/i) && numbered === 0;
  const rubberStamp = /lgtm|looks good|approved as-is/i.test(output) && numbered < 2;
  const understands = has(
    output,
    /blast radius|file (set|list)|pull request|github|snapshot/i,
  );
  const recommendation = has(
    output,
    /## Verdict|approve|request changes/i,
  );
  const tests = has(output, /test generation|\bci\b|failure path|regression/i);
  const prior = input.previousOverall;
  const regression =
    prior == null
      ? 100
      : prior - overallFromPartial() <= 5
        ? 92
        : prior - overallFromPartial() <= 12
          ? 70
          : 40;

  function overallFromPartial() {
    const rows = [
      bug ? 88 : 42,
      security ? 90 : 48,
      nuanced && !blanketReject ? 86 : 50,
      findings && numbered >= 3 && !rubberStamp ? 88 : 45,
      understands ? 84 : 40,
      recommendation ? 90 : 35,
      tests ? 82 : 60,
    ];
    return rows.reduce((a, b) => a + b, 0) / rows.length;
  }

  const metrics = [
    metric(
      PR_REVIEWER_METRICS[0],
      bug && findings ? 90 : bug ? 68 : 38,
      bug
        ? "Named intent, tests, or a failing path in the findings."
        : "Did not inspect correctness or tests.",
    ),
    metric(
      PR_REVIEWER_METRICS[1],
      security ? 92 : 44,
      security
        ? "Checked secrets, tokens, dotenv, or config noise in the diff."
        : "No security lens on the diff.",
    ),
    metric(
      PR_REVIEWER_METRICS[2],
      blanketReject ? 28 : nuanced ? 88 : 62,
      blanketReject
        ? "Rejected without numbered findings — likely a false positive."
        : nuanced
          ? "Verdict is conditional. The reviewer can approve or request changes."
          : "Verdict exists but is not calibrated against findings.",
    ),
    metric(
      PR_REVIEWER_METRICS[3],
      rubberStamp ? 22 : findings && numbered >= 3 ? 90 : 50,
      rubberStamp
        ? "Rubber-stamped the change. False negative risk is high."
        : findings
          ? `${numbered} numbered findings. The miss path is named, not skipped.`
          : "Findings section is thin.",
    ),
    metric(
      PR_REVIEWER_METRICS[4],
      understands ? 86 : 40,
      understands
        ? "Tied the review to the PR, file set, or repository snapshot."
        : "Did not show it read the change.",
    ),
    metric(
      PR_REVIEWER_METRICS[5],
      recommendation ? 88 : 34,
      recommendation
        ? "Left an actionable verdict: approve or request changes."
        : "No recommendation an operator can execute.",
    ),
    metric(
      PR_REVIEWER_METRICS[6],
      prior == null ? (tests ? 84 : 70) : regression,
      prior == null
        ? tests
          ? "No prior baseline. This run still locked tests or a failure path."
          : "No prior baseline. Score this run, then watch the next prompt or model change."
        : regression >= 80
          ? `Held vs last run (${prior}%).`
          : `Dropped vs last run (${prior}%). Prompt, model, tool, or orchestration changed quality.`,
    ),
  ];
  const score = overall(metrics);
  return {
    suite: suite.id,
    label: suite.label,
    overall: score,
    verdict: verdictForScore(score),
    metrics,
  };
}

function pickSibling(
  input: ScoreInput,
  role: string,
  nameMatch?: RegExp,
) {
  return (input.siblingOutputs || []).find(
    (row) =>
      row.role === role &&
      (!nameMatch || nameMatch.test(row.name)) &&
      row.output &&
      !isHold(row.output),
  );
}

function scoreIncident(
  suite: EvalSuite,
  input: ScoreInput,
  output: string,
): EvalResult {
  const siblings = input.siblingOutputs || [];
  const rca =
    pickSibling(input, "root_cause")?.output ||
    (input.role === "root_cause" ? output : "");
  const evidence =
    pickSibling(input, "log_analysis")?.output ||
    (input.role === "log_analysis" ? output : output);
  const plan =
    pickSibling(input, "architect")?.output ||
    (has(output, /Recommended Fix|remediation/i) ? output : "");
  const developer = pickSibling(input, "developer");
  const qa = pickSibling(input, "qa");
  const security = pickSibling(input, "security", /security review/i);
  const approval = (input.siblingOutputs || []).find((row) =>
    isHumanGate(row.name, null),
  );

  const namedCause = has(
    rca || output,
    /\*\*Root Cause:\*\*|missing (db )?index|bisect candidate/i,
  );
  const pinned = has(rca || output, /`[a-f0-9]{7,}`|version\s+[\d.]+/i);
  const evidenceTable = has(
    evidence,
    /\| Logs \||Check logs|Metrics \||Traces \||Git commits/i,
  );
  const notInvented = has(
    evidence || output,
    /do not invent|no sha|snapshot empty|not facts/i,
  );
  const invented = has(
    output,
    /stack frame [A-Z]{3}-\d{4}|definitely caused by/i,
  );
  const fix = has(
    rca || plan || output,
    /Recommended Fix|add index|forward-fix|rollback/i,
  );
  const bounded = has(
    plan || rca || output,
    /bounded|smallest|do not revert or ship from this step/i,
  );
  const recovered =
    developer?.status === "completed" && qa?.status === "completed";
  const recovering = developer?.status === "completed";
  const humanGate = Boolean(approval);
  const securityBeforeFix = Boolean(security);

  const metrics = [
    metric(
      INCIDENT_METRICS[0],
      namedCause && pinned ? 92 : namedCause ? 74 : 36,
      namedCause
        ? pinned
          ? "Named a root cause and pinned it to a SHA or deploy marker."
          : "Named a root cause without a SHA. Bisect is still a guess."
        : "No structured root cause.",
    ),
    metric(
      INCIDENT_METRICS[1],
      evidenceTable ? 90 : 42,
      evidenceTable
        ? "Evidence covers logs, metrics, traces, deploys, and git."
        : "Evidence pack is missing the collection table.",
    ),
    metric(
      INCIDENT_METRICS[2],
      fix && bounded ? 88 : fix ? 70 : 40,
      fix
        ? "Recommended a bounded fix. Architect / RCA did not ship from this step."
        : "No actionable remediation.",
    ),
    metric(
      INCIDENT_METRICS[3],
      invented ? 18 : notInvented ? 90 : 64,
      invented
        ? "Invented frames or certainty that the brief does not support."
        : notInvented
          ? "Marked what is not a fact. Hallucination rate stays low."
          : "Did not invent loudly, but also did not bound uncertainty.",
    ),
    metric(
      INCIDENT_METRICS[4],
      recovered ? 90 : recovering ? 78 : siblings.length ? 48 : 60,
      recovered
        ? "Fix and tests completed after RCA. Recovery path held."
        : recovering
          ? "Fix landed. Tests or deploy still in the playbook."
          : "Recovery steps have not completed.",
    ),
    metric(
      INCIDENT_METRICS[5],
      humanGate && securityBeforeFix ? 92 : humanGate ? 76 : 30,
      humanGate
        ? securityBeforeFix
          ? "Security review then Human Approval. Escalation is correct."
          : "Human Approval exists. Security review was thin."
        : "No human gate before deploy. Escalation failed.",
    ),
  ];
  const score = overall(metrics);
  return {
    suite: suite.id,
    label: suite.label,
    overall: score,
    verdict: verdictForScore(score),
    metrics,
  };
}

function scoreArchitect(suite: EvalSuite, output: string): EvalResult {
  const metrics = [
    metric(
      suite.metrics[0],
      has(output, /smallest|bound|not a rewrite|blast radius/i) ? 88 : 48,
      "Plan stays inside a slice, or it does not.",
    ),
    metric(
      suite.metrics[1],
      has(output, /system impact|code:|github:|risk:/i) ? 86 : 44,
      "Named code, GitHub, and risk impact.",
    ),
    metric(
      suite.metrics[2],
      has(output, /rollback/i) ? 90 : 40,
      "Rollback is in the plan before implementation.",
    ),
    metric(
      suite.metrics[3],
      has(output, /handoff|human approval|do not open a pull request/i)
        ? 88
        : 42,
      "Next specialist is named. The architect does not jump to merge.",
    ),
  ];
  const score = overall(metrics);
  return { suite: suite.id, label: suite.label, overall: score, verdict: verdictForScore(score), metrics };
}

function scoreDeveloper(suite: EvalSuite, output: string): EvalResult {
  const liveMutate = has(output, /merged into|deployed to production|wrote the file on disk/i);
  const metrics = [
    metric(
      suite.metrics[0],
      has(output, /single vertical slice|smallest|bounded/i) ? 86 : 50,
      "Change is a slice, not a rewrite.",
    ),
    metric(
      suite.metrics[1],
      has(output, /rollback/i) ? 90 : 38,
      "Rollback note is present.",
    ),
    metric(
      suite.metrics[2],
      has(output, /qa|test|verification/i) ? 84 : 46,
      "Handoff names QA or verification.",
    ),
    metric(
      suite.metrics[3],
      liveMutate ? 12 : has(output, /does not merge|artifact|brief/i) ? 92 : 60,
      liveMutate
        ? "Claimed a live side effect. The runtime must not."
        : "Stayed on an artifact. Execution still owns the mutate.",
    ),
  ];
  const score = overall(metrics);
  return { suite: suite.id, label: suite.label, overall: score, verdict: verdictForScore(score), metrics };
}

function scoreQa(suite: EvalSuite, output: string): EvalResult {
  const cases = has(output, /happy path|regression|failure/i);
  const table = has(output, /\| Case \||Cases to add/i);
  const verdict = has(output, /verdict|pass if|hold release|go \/ no-go|go for/i);
  const metrics = [
    metric(suite.metrics[0], cases && table ? 90 : cases ? 68 : 36, "Happy path, failure, and regression are named."),
    metric(
      suite.metrics[1],
      has(output, /falsify|expected|assert/i) ? 86 : 48,
      "Cases can fail. They are not a vibe check.",
    ),
    metric(suite.metrics[2], verdict ? 88 : 40, "A go / no-go an operator can execute."),
  ];
  const score = overall(metrics);
  return { suite: suite.id, label: suite.label, overall: score, verdict: verdictForScore(score), metrics };
}

function scoreSecurity(suite: EvalSuite, output: string): EvalResult {
  const threat = has(
    output,
    /exfil|injection|threat|secret|gateway|hijack|permission/i,
  );
  const gateway = has(output, /security gateway|allow|deny|human/i);
  const escalate = has(output, /human|mandatory|do not skip/i);
  const metrics = [
    metric(suite.metrics[0], threat ? 88 : 40, "Named a real threat class."),
    metric(suite.metrics[1], gateway ? 90 : 46, "Stayed aligned with the gateway, not a parallel security product."),
    metric(suite.metrics[2], escalate ? 86 : 42, "Did not skip the human gate."),
  ];
  const score = overall(metrics);
  return { suite: suite.id, label: suite.label, overall: score, verdict: verdictForScore(score), metrics };
}

function scoreGeneric(suite: EvalSuite, output: string): EvalResult {
  const metrics = [
    metric(
      suite.metrics[0],
      has(output, /^# /m) && has(output, /^## /m) ? 80 : 40,
      "Structured markdown artifact, or a blob.",
    ),
    metric(
      suite.metrics[1],
      has(output, /upstream|snapshot|project|task/i) ? 78 : 42,
      "Grounded in the task, not a generic essay.",
    ),
    metric(
      suite.metrics[2],
      has(output, /handoff|next|human approval/i) ? 80 : 44,
      "Named the next step.",
    ),
  ];
  const score = overall(metrics);
  return { suite: suite.id, label: suite.label, overall: score, verdict: verdictForScore(score), metrics };
}

export function evaluateCompletedStep(input: ScoreInput): EvalResult | null {
  return scoreAgentRun(input);
}

function toLiveCard(
  result: EvalResult,
  step: {
    agent: { name: string; role: string };
    name: string;
    status: string;
    executionId: string;
    execution: { task: { title: string } };
  },
  sample: number,
): EvalLiveCard {
  return {
    ...result,
    agent: step.agent.name,
    role: step.agent.role,
    stepName: step.name,
    title: step.execution.task.title,
    status: step.status,
    href: `/evals/${result.suite}`,
    historyHref: `/history/${step.executionId}`,
    sample,
  };
}

export async function getIncidentEvalLive(): Promise<EvalLiveCard | null> {
  const execution = await db.execution.findFirst({
    where: {
      OR: [
        { workflow: { name: "Production alert" } },
        { task: { title: { contains: "INCIDENT" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      task: true,
      steps: {
        orderBy: { order: "asc" },
        include: { agent: true },
      },
    },
  });
  if (!execution) return null;
  const rca =
    execution.steps.find((step) => step.agent.role === "root_cause") ||
    execution.steps.find((step) => step.agent.role === "incident");
  if (!rca) return null;
  const result = scoreAgentRun({
    role: "root_cause",
    name: rca.name,
    output: rca.output,
    taskTitle: execution.task.title,
    taskType: execution.task.type,
    taskPriority: execution.task.priority,
    siblingOutputs: execution.steps.map((step) => ({
      role: step.agent.role,
      name: step.name,
      status: step.status,
      output: step.output,
    })),
  });
  if (!result) return null;
  return toLiveCard(
    { ...result, suite: "incident", label: "Incident Response" },
    {
      agent: { name: "Incident Response", role: "incident" },
      name: execution.task.title,
      status: execution.status,
      executionId: execution.id,
      execution: { task: execution.task },
    },
    execution.steps.filter((step) => step.output).length,
  );
}

export async function getPrReviewerEvalLive(): Promise<EvalLiveCard | null> {
  const steps = await db.executionStep.findMany({
    where: {
      agent: { role: { in: ["pr_reviewer", "code_reviewer"] } },
      output: { not: null },
    },
    orderBy: { startedAt: "desc" },
    take: 8,
    include: {
      agent: true,
      execution: { include: { task: true } },
    },
  });
  const usable = steps.filter(
    (step) => step.output && !isHold(step.output) && !isHumanGate(step.name),
  );
  const latest = usable[0];
  if (!latest) return null;
  const previous = usable[1]
    ? scoreAgentRun({
        role: latest.agent.role,
        name: usable[1].name,
        output: usable[1].output,
        taskTitle: usable[1].execution.task.title,
      })
    : null;
  const result = scoreAgentRun({
    role: latest.agent.role,
    name: latest.name,
    output: latest.output,
    taskTitle: latest.execution.task.title,
    previousOverall: previous?.overall ?? null,
  });
  if (!result) return null;
  return toLiveCard(result, latest, usable.length);
}

export async function getSuiteEvalLive(suiteId: string): Promise<EvalLiveCard | null> {
  if (suiteId === "incident") return getIncidentEvalLive();
  if (suiteId === "pr_reviewer") return getPrReviewerEvalLive();
  const suite = EVAL_SUITES.find((item) => item.id === suiteId);
  if (!suite) return null;
  const step = await db.executionStep.findFirst({
    where: {
      agent: { role: { in: suite.roles } },
      output: { not: null },
      startedAt: { not: null },
    },
    orderBy: { startedAt: "desc" },
    include: { agent: true, execution: { include: { task: true } } },
  });
  if (!step || isHumanGate(step.name) || isHold(step.output)) return null;
  const result = scoreAgentRun({
    role: step.agent.role,
    name: step.name,
    action: null,
    output: step.output,
    taskTitle: step.execution.task.title,
  });
  if (!result) return null;
  return toLiveCard(result, step, 1);
}

export async function getAgentEvalBoard() {
  const [featured, agents] = await Promise.all([
    Promise.all([getPrReviewerEvalLive(), getIncidentEvalLive()]),
    db.agent.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" },
      include: {
        executionSteps: {
          where: { output: { not: null }, startedAt: { not: null } },
          orderBy: { startedAt: "desc" },
          take: 3,
          include: {
            execution: {
              include: {
                task: true,
                steps: {
                  orderBy: { order: "asc" },
                  include: { agent: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const rows = agents
    .map((agent) => {
      const usable = agent.executionSteps.filter(
        (step) => !isHold(step.output) && !isHumanGate(step.name),
      );
      const latest = usable[0];
      if (!latest) {
        return {
          id: agent.id,
          agent: agent.name,
          role: agent.role,
          suite: suiteForRole(agent.role).id,
          overall: null as number | null,
          verdict: "pending" as string,
          stepName: null as string | null,
          href: `/evals/${suiteForRole(agent.role).id}`,
          sample: 0,
        };
      }
      const previous = usable[1]
        ? scoreAgentRun({
            role: agent.role,
            name: usable[1].name,
            output: usable[1].output,
            taskTitle: usable[1].execution.task.title,
            siblingOutputs: usable[1].execution.steps.map((step) => ({
              role: step.agent.role,
              name: step.name,
              status: step.status,
              output: step.output,
            })),
          })
        : null;
      const result = scoreAgentRun({
        role: agent.role,
        name: latest.name,
        output: latest.output,
        taskTitle: latest.execution.task.title,
        previousOverall: previous?.overall ?? null,
        siblingOutputs: latest.execution.steps.map((step) => ({
          role: step.agent.role,
          name: step.name,
          status: step.status,
          output: step.output,
        })),
      });
      return {
        id: agent.id,
        agent: agent.name,
        role: agent.role,
        suite: result?.suite || suiteForRole(agent.role).id,
        overall: result?.overall ?? null,
        verdict: result?.verdict || "pending",
        stepName: latest.name,
        href: `/evals/${result?.suite || suiteForRole(agent.role).id}`,
        sample: usable.length,
      };
    })
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));

  return {
    prReviewer: featured[0],
    incident: featured[1],
    rows,
  };
}

export function evalEventMessage(agentName: string, result: EvalResult) {
  return `${agentName} eval ${result.overall}% · ${result.verdict} · ${result.label}`;
}

export function compactEvalMetrics(result: EvalResult) {
  return result.metrics
    .slice(0, 6)
    .map((row) => `${row.label}: ${row.score}%`)
    .join(" · ");
}

export function evalExcerpt(result: EvalResult) {
  const worst = [...result.metrics].sort((a, b) => a.score - b.score)[0];
  return worst
    ? `${worst.label} · ${truncate(worst.evidence, 120)}`
    : "No metrics.";
}
