import { cx } from "@/lib/utils";
import type { DebugTimeline } from "@/lib/debug-log";

export function DebugTimelineView({
  timeline,
  example = false,
}: {
  timeline: DebugTimeline;
  example?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {example ? "Example debug log" : "Chronological debug log"}
      </div>
      <div className="font-mono text-[12px] leading-6 text-live">
        {timeline.heading}
      </div>
      <div className="mt-3 space-y-1 font-mono text-[11px] leading-5 sm:text-[12px]">
        {timeline.lines.length === 0 ? (
          <p className="text-muted">Events appear as the orchestrator runs.</p>
        ) : (
          timeline.lines.map((line, index) => (
            <div key={`${line.clock}-${line.seq}-${index}`}>
              <div className="flex gap-3">
                <span className="w-[4.5rem] shrink-0 text-muted">{line.clock}</span>
                <span
                  className={cx(
                    line.kind === "gateway"
                      ? "text-warn"
                      : line.kind === "qa"
                        ? "text-danger"
                        : line.kind === "result"
                          ? "text-foreground"
                          : "text-live",
                  )}
                >
                  {line.title}
                </span>
              </div>
              {line.details?.map((detail) => (
                <div key={detail} className="flex gap-3 text-muted">
                  <span className="w-[4.5rem] shrink-0" />
                  <span>→ {detail}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
