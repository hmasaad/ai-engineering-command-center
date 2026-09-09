import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import {
  AGENT_RUNTIME_ASCII,
  AGENT_RUNTIME_DUTIES,
  AGENT_RUNTIME_WALK,
  AGENT_RUNTIME_WALK_ASCII,
  type RuntimeLiveSession,
} from "@/lib/agent-runtime";
import { formatDuration } from "@/lib/observability";
import { cx } from "@/lib/utils";

export function AgentRuntimeAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Agent Runtime
      </div>
      <pre className="font-mono text-[11px] leading-5 text-live sm:text-[12px] whitespace-pre">
        {AGENT_RUNTIME_ASCII}
      </pre>
    </div>
  );
}

export function AgentRuntimeWalkAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        For example
      </div>
      <pre className="font-mono text-[11px] leading-5 text-foreground sm:text-[12px] whitespace-pre">
        {AGENT_RUNTIME_WALK_ASCII}
      </pre>
    </div>
  );
}

export function AgentRuntimeDuties() {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        What the Agent Runtime does
      </div>
      <p className="mb-4 text-sm text-muted">
        It is the layer responsible for running an agent safely and consistently. For every agent execution, it manages:
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {AGENT_RUNTIME_DUTIES.map((duty) => (
          <li key={duty.id} className="rounded-lg border border-line bg-background px-3 py-2">
            <div className="font-mono text-[11px] text-live">{duty.label}</div>
            <p className="mt-1 text-xs text-muted">{duty.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AgentRuntimeNodes() {
  return (
    <div className="flex flex-wrap gap-2">
      {AGENT_RUNTIME_WALK.map((phase) => (
        <Link
          key={phase.id}
          href={phase.href}
          className="rounded-full border border-line bg-panel-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted hover:border-live/50 hover:text-live"
        >
          {phase.id}
        </Link>
      ))}
    </div>
  );
}

export function AgentRuntimeLive({ session }: { session: RuntimeLiveSession }) {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live bound run
          </div>
          <Link href={session.href} className="mt-1 block text-sm font-medium hover:text-live">
            {session.agent} · {session.stepName}
          </Link>
          <p className="mt-1 text-xs text-muted">
            {session.project} · {session.task}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={session.status} />
          <Link
            href={session.historyHref}
            className="font-mono text-[10px] uppercase tracking-wider text-muted hover:text-live"
          >
            History
          </Link>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Meta label="Model" value={session.model} />
        <Meta label="Timeout" value={`${session.timeoutMs / 1000}s`} />
        <Meta
          label="Retries"
          value={session.retries ? `${session.retries} recorded` : "none"}
        />
        <Meta label="Tokens" value={session.tokens.toLocaleString()} />
        <Meta label="Cost" value={session.cost} />
        <Meta label="Duration" value={formatDuration(session.durationMs)} />
      </div>

      <p className="mb-4 text-xs text-muted">{session.systemPrompt}</p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {session.tools.slice(0, 6).map((tool) => (
          <span
            key={tool}
            className="rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-live"
          >
            {tool}
          </span>
        ))}
      </div>

      {session.calls.length > 0 ? (
        <div className="mb-4 space-y-1">
          {session.calls.slice(0, 4).map((call, index) => (
            <div
              key={`${call.tool}-${index}`}
              className="flex items-center justify-between gap-2 font-mono text-[11px]"
            >
              <span>{call.tool}</span>
              <span className="text-muted">
                {call.verdict} · risk {call.risk}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <ol className="space-y-2">
        {session.phases.map((phase, index) => (
          <li key={phase.id}>
            <Link
              href={phase.href}
              className={cx(
                "flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:border-live/40",
                phase.status === "done"
                  ? "border-live/30 bg-background"
                  : phase.status === "active"
                    ? "border-warn/40 bg-background"
                    : "border-line bg-background text-muted",
              )}
            >
              <span>
                <span className="font-mono text-[10px] text-muted">{index + 1}.</span>{" "}
                {phase.label}
                <span className="mt-0.5 block text-xs text-muted">{phase.detail}</span>
              </span>
              <StatusBadge status={phase.status === "done" ? "completed" : phase.status === "active" ? "running" : "pending"} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-background px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-mono text-xs">{value}</div>
    </div>
  );
}
