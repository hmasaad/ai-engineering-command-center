import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import {
  FEEDBACK_LOOP_ASCII,
  FEEDBACK_LOOP_STAGES,
  FEEDBACK_LOOP_WALK_ASCII,
} from "@/lib/feedback-loop";
import { cx } from "@/lib/utils";

export function FeedbackLoopAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        The feedback loop
      </div>
      <pre className="font-mono text-[11px] leading-5 text-live sm:text-[12px] whitespace-pre">
        {FEEDBACK_LOOP_ASCII}
      </pre>
    </div>
  );
}

export function FeedbackLoopWalkAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        For example
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-foreground sm:text-[13px]">
        {FEEDBACK_LOOP_WALK_ASCII}
      </pre>
    </div>
  );
}

export function FeedbackLoopNodes() {
  return (
    <div className="flex flex-wrap gap-2">
      {FEEDBACK_LOOP_STAGES.map((stage) => (
        <Link
          key={stage.id}
          href={stage.href}
          className="rounded-full border border-line bg-panel-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-live/50 hover:text-live"
        >
          {stage.id}
        </Link>
      ))}
    </div>
  );
}

type LiveStage = {
  id: string;
  label: string;
  href: string;
  stepName: string | null;
  agent: string | null;
  status: string;
};

export function FeedbackLoopLive({
  title,
  status,
  href,
  historyHref,
  stages,
}: {
  title: string;
  status: string;
  href: string;
  historyHref: string;
  stages: LiveStage[];
}) {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live loop
          </div>
          <Link href={href} className="mt-1 block text-sm font-medium hover:text-live">
            {title}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <Link
            href={historyHref}
            className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-live"
          >
            History
          </Link>
        </div>
      </div>
      <ol className="space-y-2">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-live" />
            <div className="min-w-0">
              <Link href={stage.href} className="text-sm hover:text-live">
                {index + 1}. {stage.label}
              </Link>
              <div className={cx("font-mono text-[11px] text-muted", !stage.stepName && "opacity-60")}>
                {stage.stepName
                  ? `${stage.agent} · ${stage.stepName} · ${stage.status.replace(/_/g, " ")}`
                  : "Waiting on this pass"}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
