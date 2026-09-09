"use client";

import { useMemo, useState } from "react";
import { runAutonomousIntent } from "@/lib/actions";
import { TASK_PRIORITIES } from "@/lib/constants";
import {
  INTENT_EXAMPLES,
  parseEngineeringIntent,
} from "@/lib/autonomous";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ReleaseFlow } from "@/components/release-flow";
import { TaskGraphAscii } from "@/components/task-graph";

export function AutonomousIntentForm({
  projects,
}: {
  projects: Array<{ id: string; name: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [intent, setIntent] = useState(
    "Analyze PR #182, identify problems, fix them, test the fix, and prepare it for review.",
  );
  const parsed = useMemo(() => parseEngineeringIntent(intent), [intent]);

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Register a project first. Autonomous Engineering expands an intent against a Command Center project.
      </p>
    );
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await runAutonomousIntent(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-4 rounded-xl border border-line bg-panel/80 p-5"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Developer
      </div>
      <div className="text-sm text-muted">↓</div>

      <Field label="Intent">
        <input
          name="intent"
          required
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          placeholder="Analyze PR #182, identify problems, fix them, test the fix, and prepare it for review."
          className={fieldClass}
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {INTENT_EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            onClick={() => setIntent(example.intent)}
            className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-live/50"
          >
            {example.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project">
          <select
            name="projectId"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={fieldClass}
          >
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="high" className={fieldClass}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          rows={3}
          placeholder="Anything the release must mention — breaking APIs, flags, or a freeze window."
          className={fieldClass}
        />
      </Field>

      {parsed ? (
        <div className="space-y-3 rounded-lg border border-live/30 bg-background p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-live">The system creates</span>
            <span className="rounded-full bg-live/15 px-2 py-0.5 font-mono text-[10px] uppercase text-live">
              {parsed.playbookName}
            </span>
            {parsed.version ? (
              <span className="font-mono text-muted">v{parsed.version}</span>
            ) : null}
            <span className="font-mono text-muted">
              {Math.round(parsed.confidence * 100)}% match
            </span>
          </div>
          {parsed.id === "pr_fix" ? (
            <TaskGraphAscii title="The orchestrator creates" />
          ) : (
            <ReleaseFlow playbook={parsed.playbookName} />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Type a goal such as “Analyze PR #182, identify problems, fix them, test the fix, and prepare it for review.” Command Center will expand it into AI PR Resolution.
        </p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>
        {parsed ? `Run ${parsed.playbookName}` : "Expand intent"}
      </SubmitButton>
    </form>
  );
}
