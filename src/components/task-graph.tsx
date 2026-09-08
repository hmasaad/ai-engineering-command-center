import { StatusBadge } from "@/components/ui";
import { PR_FIX_ASCII, toPublicGraphTask } from "@/lib/orchestrator/graph";
import type { GraphTask } from "@prisma/client";
import { cx, parseJson } from "@/lib/utils";

export function TaskGraphAscii({
  title = "Task graph",
}: {
  title?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {title}
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-live sm:text-[13px]">
        {PR_FIX_ASCII}
      </pre>
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
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Task graph
      </div>
      <p className="mb-4 text-xs text-muted">
        The orchestrator expanded the intent into dependent tasks. A node does not run until its dependencies have completed.
      </p>
      <ol className="space-y-2">
        {nodes
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((node, index) => {
            const deps = parseJson<string[]>(node.dependencies, []);
            const depNames = deps
              .map((id) => byId.get(id)?.name)
              .filter(Boolean)
              .join(", ");
            return (
              <li key={node.id}>
                {index > 0 ? (
                  <div className="mb-2 flex justify-center font-mono text-xs text-muted">↓</div>
                ) : null}
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
                    {(parseJson<string[]>(node.toolsUsed, [])).map((tool) => (
                      <span key={tool} className="text-live">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
      </ol>
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
