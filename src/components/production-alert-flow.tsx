import { PRODUCTION_ALERT_FLOW } from "@/lib/operations";

export function ProductionAlertFlow() {
  return (
    <div className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Production alert playbook
      </div>
      <div className="flex flex-col">
        {PRODUCTION_ALERT_FLOW.map((stage, index) => (
          <div key={`${stage.label}-${index}`} className="flex gap-3">
            <div className="flex w-6 flex-col items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  stage.gate ? "bg-warn" : index === 0 ? "bg-danger" : "bg-live"
                }`}
              />
              {index < PRODUCTION_ALERT_FLOW.length - 1 ? (
                <span className="h-5 w-px bg-line" />
              ) : null}
            </div>
            <div className="pb-3 text-sm">
              {stage.label}
              {stage.gate ? (
                <span className="ml-2 font-mono text-[10px] uppercase text-warn">
                  gate
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
