import Link from "next/link";
import { ControlPlaneAscii, ControlPlaneLayers } from "@/components/control-plane";
import { cx } from "@/lib/utils";

type Node = {
  id: string;
  label: string;
  href: string;
  count?: number;
};

export function ArchitectureMap({
  projects,
  agents,
  tasks,
  approvals,
}: {
  projects: number;
  agents: number;
  tasks: number;
  approvals: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Control plane
        </div>
        <Link
          href="/architecture"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-live"
        >
          Why this order
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        Policy, verification, observability, and risk sit in front of Execution. Agents do not modify code, deploy, or touch production until that path completes.
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <NodeChip node={{ id: "projects", label: "Projects", href: "/projects", count: projects }} />
        <NodeChip node={{ id: "agents", label: "Agents", href: "/agents", count: agents }} />
        <NodeChip node={{ id: "tasks", label: "Tasks", href: "/tasks", count: tasks }} />
      </div>

      <ControlPlaneAscii />

      <div className="mt-5">
        <ControlPlaneLayers approvals={approvals} />
      </div>
    </div>
  );
}

function NodeChip({ node }: { node: Node }) {
  return (
    <Link
      href={node.href}
      className={cx(
        "flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-foreground",
      )}
    >
      <span className="font-medium">{node.label}</span>
      <span className="font-mono text-[10px] text-muted">{node.count}</span>
    </Link>
  );
}
