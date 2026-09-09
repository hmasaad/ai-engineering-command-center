import { cx } from "@/lib/utils";
import {
  TOOL_GATEWAY_ASCII,
  TOOL_LAYER,
  TOOL_LAYER_ASCII,
  TOOL_LAYER_GROUPS,
} from "@/lib/tool-layer";

export function ToolLayerAscii() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Catalog
        </div>
        <pre className="font-mono text-[12px] leading-6 text-live sm:text-[13px]">
          {TOOL_LAYER_ASCII}
        </pre>
      </div>
      <div className="overflow-x-auto rounded-xl border border-warn/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,176,80,0.08)]">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Security Gateway
          </div>
        <pre className="font-mono text-[11px] leading-5 text-warn sm:text-[12px]">
          {TOOL_GATEWAY_ASCII}
        </pre>
      </div>
    </div>
  );
}

export function ToolLayerGroups() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {TOOL_LAYER_GROUPS.map((group) => (
        <section
          key={group.id}
          className="rounded-xl border border-line bg-panel/80 p-5"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            {group.label}
          </div>
          <ul className="mt-3 space-y-2">
            {TOOL_LAYER.filter((tool) => tool.group === group.id).map((tool) => (
              <li key={tool.name} className="rounded-lg border border-line bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{tool.short}</span>
                  <span
                    className={cx(
                      "font-mono text-[10px] uppercase",
                      tool.sideEffect ? "text-warn" : "text-live",
                    )}
                  >
                    {tool.sideEffect ? "side-effect" : "read"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{tool.description}</p>
                <div className="mt-1 font-mono text-[10px] text-muted">
                  {tool.name} · risk {tool.risk}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
