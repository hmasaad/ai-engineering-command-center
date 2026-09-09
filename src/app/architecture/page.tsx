import Link from "next/link";
import { ControlPlaneAscii } from "@/components/control-plane";
import { HitlAscii, HitlTable } from "@/components/hitl";
import {
  SecurityGatewayAscii,
  SecurityGatewayChecks,
  SecurityGatewayExamples,
} from "@/components/security-gateway";
import { TaskGraphAscii } from "@/components/task-graph";
import { GhostLink, PageHeader } from "@/components/ui";
import { CONTROL_PLANE } from "@/lib/control-plane";

export default function ArchitecturePage() {
  const tools = CONTROL_PLANE.find((layer) => layer.id === "tools");
  const agents = CONTROL_PLANE.find((layer) => layer.id === "agents");
  const linear = CONTROL_PLANE.filter(
    (layer) => layer.id !== "tools" && layer.id !== "agents",
  );
  const before = linear.slice(0, 4);
  const after = linear.slice(4);

  return (
    <div>
      <PageHeader
        kicker="Control plane"
        title="Architecture"
        description="Once agents can modify code, deploy applications, access databases, or respond to production incidents, policy, permissions, verification, and risk are not optional extras. They are the path."
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
