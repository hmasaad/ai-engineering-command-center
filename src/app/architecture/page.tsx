import Link from "next/link";
import { ControlPlaneAscii } from "@/components/control-plane";
import {
  FeedbackLoopAscii,
  FeedbackLoopLive,
  FeedbackLoopNodes,
  FeedbackLoopWalkAscii,
} from "@/components/feedback-loop";
import { HitlAscii, HitlTable } from "@/components/hitl";
import { IncidentResponseAscii } from "@/components/incident-response";
import {
  AutonomyControlledAscii,
  AutonomyExampleCards,
  AutonomyInitialAscii,
  AutonomyUnsafeAscii,
} from "@/components/autonomous-execution";
import {
  AgentRuntimeAscii,
  AgentRuntimeDuties,
  AgentRuntimeLive,
  AgentRuntimeWalkAscii,
} from "@/components/agent-runtime";
import {
  AgentStateAscii,
  AgentStateExampleJson,
  AgentStateLive,
  AgentStateUnsafeAscii,
} from "@/components/agent-state";
import {
  ModelRouterAscii,
  ModelRouterExamples,
  ModelRouterLive,
  ModelRouterUnsafeAscii,
} from "@/components/model-router";
import {
  AgentEvalFeaturedSuites,
  AgentEvalLive,
  AgentEvalsAscii,
  AgentEvalsUnsafeAscii,
} from "@/components/agent-evals";
import {
  ObservabilityAscii,
  ObservabilityCaptureTree,
  ObservabilityExampleLog,
} from "@/components/observability-layer";
import {
  SecurityGatewayAscii,
  SecurityGatewayChecks,
  SecurityGatewayExamples,
} from "@/components/security-gateway";
import { TaskGraphAscii } from "@/components/task-graph";
import { GhostLink, PageHeader } from "@/components/ui";
import { CONTROL_PLANE } from "@/lib/control-plane";
import { getFeedbackLoopLive } from "@/lib/feedback-loop";
import { getRuntimeLive } from "@/lib/agent-runtime";
import { getLiveWorkflowState } from "@/lib/agent-state";
import { getModelRouteLedger } from "@/lib/model-router";
import { getAgentEvalBoard } from "@/lib/agent-evals";

export default async function ArchitecturePage() {
  const [loop, runtime, routing, evals, state] = await Promise.all([
    getFeedbackLoopLive(),
    getRuntimeLive(),
    getModelRouteLedger(),
    getAgentEvalBoard(),
    getLiveWorkflowState(),
  ]);
  const tools = CONTROL_PLANE.find((layer) => layer.id === "tools");
  const agents = CONTROL_PLANE.find((layer) => layer.id === "agents");
  const linear = CONTROL_PLANE.filter(
    (layer) => layer.id !== "tools" && layer.id !== "agents",
  );
  const before = linear.slice(0, 6);
  const after = linear.slice(6);

  return (
    <div>
      <PageHeader
        kicker="Control plane"
        title="Architecture"
        description="The orchestrator schedules. The Agent Runtime runs each specialist. The Model Router picks the model. Agent Evals ask whether that specialist is actually good."
        actions={<GhostLink href="/">Command Center</GhostLink>}
      />

      <ControlPlaneAscii />

      <p className="mt-3 max-w-3xl text-xs text-muted">
        Tool execution and agent execution fork in parallel, then rejoin. Low-risk reads, tests, and branches are automatic. Create PR is review recommended. Config changes, deploys, and database deletes are mandatory. Agents never skip the Security Gateway or Human-in-the-loop.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <HitlAscii />
        <HitlTable />
      </div>

      <div className="mt-8">
        <SecurityGatewayAscii />
        <p className="mt-3 max-w-3xl text-xs text-muted">
          The gateway is the security boundary around agents. github.read_file can be low and automatic. production_database.delete is critical and waits for a human. Sending customer data to an external API is blocked as exfiltration.
        </p>
        <div className="mt-6">
          <SecurityGatewayExamples />
        </div>
        <div className="mt-6">
          <SecurityGatewayChecks />
        </div>
      </div>

      <div className="mt-8">
        <ObservabilityAscii />
        <p className="mt-3 max-w-3xl text-xs text-muted">
          Security is the gate. Observability is the flight recorder. Once you have an orchestrator and several specialists, a failure is un-debugable without agent input, tools, tokens, cost, duration, and the gateway decision.
        </p>
        <div className="mt-6">
          <ObservabilityCaptureTree />
        </div>
        <div className="mt-6">
          <ObservabilityExampleLog />
        </div>
      </div>

      <div className="mt-8">
        <IncidentResponseAscii />
        <p className="mt-3 max-w-3xl text-xs text-muted">
          A production 500 spike is not a dashboard tour. The Command Center starts a workflow: evidence, RCA, remediation, security, fix, test, human approval, deploy, monitor.
        </p>
      </div>

      <div className="mt-8">
        <div className="grid gap-3 lg:grid-cols-2">
          <AutonomyInitialAscii />
          <AutonomyControlledAscii />
        </div>
        <div className="mt-3">
          <AutonomyUnsafeAscii />
        </div>
        <p className="mt-3 max-w-3xl text-xs text-muted">
          The first version always waits: AI suggests, a human approves, then the system executes. Controlled autonomy comes later — detect, investigate, plan, risk evaluation — then low is automatic, medium is approval, high is mandatory human. That is safer than unconstrained execution.
        </p>
        <div className="mt-6">
          <AutonomyExampleCards />
        </div>
      </div>

      <div className="mt-8">
        <FeedbackLoopAscii />
        <p className="mt-3 max-w-3xl text-xs text-muted">
          Gateway, observability, incident response, and execution are one cycle. A signal comes back as a workflow; every action still hits the gateway; the trace closes the loop.
        </p>
        <div className="mt-3">
          <FeedbackLoopNodes />
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <FeedbackLoopWalkAscii />
          {loop ? (
            <FeedbackLoopLive
              title={loop.title}
              status={loop.status}
              href={loop.href}
              historyHref={loop.historyHref}
              stages={loop.stages}
            />
          ) : (
            <p className="self-center text-sm text-muted">
              Run Production alert to see this loop on a live execution.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <AgentRuntimeAscii />
        <p className="mt-3 max-w-3xl text-xs text-muted">
          The orchestrator does not run the specialist. The Agent Runtime loads identity, context, memory, and tools, the Model Router picks the lane, then every tool call still hits the Security Gateway.
        </p>
        <div className="mt-6">
          <AgentRuntimeDuties />
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <AgentRuntimeWalkAscii />
          <p className="self-center text-sm text-muted">
            Developer Agent is a registry record. The runtime loads it, binds context and memory, the Model Router picks the lane, grants declared tools, executes, and intercepts every tool call into the Security Gateway.
          </p>
        </div>
        <div className="mt-6">
          {runtime ? (
            <AgentRuntimeLive session={runtime} />
          ) : (
            <p className="text-sm text-muted">
              Run a Developer step to see a live bound session.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="grid gap-3 lg:grid-cols-2">
          <ModelRouterAscii />
          <ModelRouterUnsafeAscii />
        </div>
        <p className="mt-3 max-w-3xl text-xs text-muted">
          Once multiple agents exist, do not make every agent use the same model. Format and summaries stay cheap. Architecture, RCA, and security spend the reasoning budget.
        </p>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <ModelRouterExamples />
          {routing ? (
            <ModelRouterLive ledger={routing} />
          ) : (
            <p className="self-center text-sm text-muted">
              Run Production alert to see fast, reasoning, and specialized lanes on one workflow.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="grid gap-3 lg:grid-cols-2">
          <AgentEvalsAscii />
          <AgentEvalsUnsafeAscii />
        </div>
        <p className="mt-3 max-w-3xl text-xs text-muted">
          Observability records the run. Evals score the agent. A prompt, model, tool, or orchestration change is measured on the next bound run — not shipped because the demo looked fine.
        </p>
        <div className="mt-6">
          <AgentEvalFeaturedSuites />
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {evals.prReviewer ? (
            <AgentEvalLive card={evals.prReviewer} compact />
          ) : (
            <p className="self-center text-sm text-muted">
              Run PR Reviewer to score bug detection, security, and recommendation quality.
            </p>
          )}
          {evals.incident ? (
            <AgentEvalLive card={evals.incident} compact />
          ) : (
            <p className="self-center text-sm text-muted">
              Run Production alert to score RCA, evidence, hallucination, recovery, and escalation.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="grid gap-3 lg:grid-cols-2">
          <AgentStateAscii />
          <AgentStateUnsafeAscii />
        </div>
        <p className="mt-3 max-w-3xl text-xs text-muted">
          Agents are not stateless chatbots. Every workflow keeps a durable document: goal, plan, tasks, current task, agent states, tool results, decisions, errors, approvals, final result.
        </p>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <AgentStateExampleJson />
          {state ? (
            <AgentStateLive
              title={state.title}
              status={state.document.status}
              href={state.href}
              historyHref={state.historyHref}
              compact={state.compact}
            />
          ) : (
            <p className="self-center text-sm text-muted">
              Run Production alert to persist a live workflow state document.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <TaskGraphAscii title="First real workflow — AI PR Resolution" />
        <p className="mt-3 max-w-3xl text-xs text-muted">
          That graph is what a user request like “Analyze PR #182, identify problems, fix them, test the fix, and prepare it for review.” expands into. Parallel review joins before Generate Fix. Create PR is after Human Approval.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {before.map((layer) => (
          <LayerCard key={layer.id} layer={layer} />
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          {tools ? <LayerCard layer={tools} /> : null}
          {agents ? <LayerCard layer={agents} /> : null}
        </div>
        {after.map((layer) => (
          <LayerCard key={layer.id} layer={layer} />
        ))}
      </div>
    </div>
  );
}

function LayerCard({ layer }: { layer: (typeof CONTROL_PLANE)[number] }) {
  return (
    <Link
      href={layer.href}
      className="block rounded-xl border border-line bg-panel/80 p-5 hover:border-live/40"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {layer.id}
      </div>
      <h2 className="mt-1 text-sm font-medium">{layer.label}</h2>
      <p className="mt-2 text-sm text-muted">{layer.why}</p>
    </Link>
  );
}
