import { StatusBadge } from "@/components/ui";
import { PR_RESOLUTION_ASCII, toPublicGraphTask } from "@/lib/orchestrator/graph";
import type { GraphTask } from "@prisma/client";
import { cx, parseJson } from "@/lib/utils";

export function TaskGraphAscii({
  title = "AI PR Resolution",
}: {
  title?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {title}
      </div>
      <pre className="text-center font-mono text-[11px] leading-5 text-live sm:text-[12px]">
        {PR_RESOLUTION_ASCII}
      </pre>
    </div>
  );
}

function depKey(node: GraphTask) {
  return parseJson<string[]>(node.dependencies, []).slice().sort().join("|");
}

function wavesFrom(nodes: GraphTask[]) {
  const sorted = nodes.slice().sort((a, b) => a.order - b.order);
  const waves: GraphTask[][] = [];
  for (const node of sorted) {
    const last = waves.at(-1);
    if (
      last &&
      last.length > 0 &&
      depKey(last[0]) === depKey(node) &&
      last.every((peer) => {
        const deps = parseJson<string[]>(node.dependencies, []);
        const peerDeps = parseJson<string[]>(peer.dependencies, []);
        return !deps.includes(peer.id) && !peerDeps.includes(node.id);
      })
    ) {
      last.push(node);
    } else {
      waves.push([node]);
    }
  }
  return waves;
}

function GraphNodeCard({
  node,
  index,
  byId,
}: {
  node: GraphTask;
  index: number;
  byId: Map<string, GraphTask>;
}) {
  const deps = parseJson<string[]>(node.dependencies, []);
  const depNames = deps
    .map((id) => byId.get(id)?.name)
    .filter(Boolean)
    .join(", ");
  return (
    <div
      className={cx(
        "rounded-lg border bg-background px-4 py-3",
        node.approvalRequired ? "border-warn/40" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Task #{index + 1}
            {depNames ? ` · after ${depNames}` : " · root"}
          </div>
          <div className="mt-1 font-medium">{node.name}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={node.status} />
          {node.approvalRequired ? (
            <span className="font-mono text-[10px] uppercase text-warn">gate</span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px] text-muted">
        <span>risk {node.risk}</span>
        {parseJson<string[]>(node.toolsUsed, []).map((tool) => (
          <span key={tool} className="text-live">
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LiveTaskGraph({
  nodes,
}: {
  nodes: GraphTask[];
}) {
  if (nodes.length === 0) return null;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const waves = wavesFrom(nodes);
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Task graph
      </div>
      <p className="mb-4 text-xs text-muted">
        The orchestrator expanded the intent into dependent tasks. Code Review, Security, and Bug
        Analysis share a plan and run as a wave. Create PR waits for Human Approval.
      </p>
      <div className="space-y-2">
        {waves.map((wave, waveIndex) => (
          <div key={wave.map((node) => node.id).join("-")}>
            {waveIndex > 0 ? (
              <div className="mb-2 flex justify-center font-mono text-xs text-muted">
                {wave.length > 1 ? "┌─────────────┼─────────────┐" : "↓"}
              </div>
            ) : null}
            {wave.length > 1 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {wave.map((node) => (
                  <GraphNodeCard
                    key={node.id}
                    node={node}
                    index={nodes.findIndex((item) => item.id === node.id)}
                    byId={byId}
                  />
                ))}
              </div>
            ) : (
              <GraphNodeCard
                node={wave[0]}
                index={nodes.findIndex((item) => item.id === wave[0].id)}
                byId={byId}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function GraphTaskRecord({ node }: { node: GraphTask }) {
  const json = toPublicGraphTask(node);
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-[#070d14] p-3 font-mono text-[11px] leading-5 text-muted">
      {JSON.stringify(json, null, 2)}
    </pre>
  );
}
