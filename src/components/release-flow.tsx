import { RELEASE_FLOW } from "@/lib/autonomous";
import { PRODUCTION_ALERT_FLOW } from "@/lib/operations";

export function ReleaseFlow({
  playbook = "Release",
}: {
  playbook?: string;
}) {
  const stages = playbook === "Production alert" ? PRODUCTION_ALERT_FLOW : RELEASE_FLOW;
  const title =
    playbook === "Production alert" ? "Production alert playbook" : "Release workflow";
  return (
    <div className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {title}
      </div>
      <div className="font-mono text-xs leading-6 text-foreground">
        <div className="text-live">{playbook === "Production alert" ? "Production Alert" : "Release Workflow"}</div>
        <div className="text-muted">│</div>
        {stages.map((stage, index) => {
          const last = index === stages.length - 1;
          const prefix = last ? "└──" : "├──";
          return (
            <div key={`${stage.label}-${index}`} className="flex items-center gap-2">
              <span className="text-muted">{prefix}</span>
              <span className={stage.gate ? "text-warn" : ""}>{stage.label}</span>
              {stage.gate ? (
                <span className="font-mono text-[10px] uppercase text-warn">gate</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
