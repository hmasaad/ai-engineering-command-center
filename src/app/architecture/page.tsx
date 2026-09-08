import Link from "next/link";
import { ControlPlaneAscii } from "@/components/control-plane";
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
        Tool execution and agent execution fork in parallel, then rejoin. Side effects — create_pr, CI, deploy, rollback — wait until Verification, Observability, and Risk / Approval have all run. That last node is Execution. Agents never skip the Tool Gateway.
      </p>

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
