"use client";

import { useState } from "react";
import { createAgent } from "@/lib/actions";
import { AGENT_ROLES } from "@/lib/constants";
import { DOMAINS } from "@/lib/development";
import {
  CODE_REVIEWER_SPEC,
  DEFAULT_MODEL,
  PERMISSION_GRANTS,
  RISK_LEVELS,
  specToPublicJson,
} from "@/lib/registry";
import { layerToolsHint } from "@/lib/tool-layer";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AgentForm() {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await createAgent(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-4 rounded-xl border border-line bg-panel/80 p-5"
    >
      <Field label="Id" hint="Stable registry id. Example: code-reviewer. Leave blank to generate.">
        <input name="id" placeholder="code-reviewer" className={fieldClass} />
      </Field>
      <Field label="Name">
        <input name="name" required placeholder="Code Reviewer" className={fieldClass} />
      </Field>
      <Field label="Description">
        <textarea name="description" required rows={3} className={fieldClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Role"
          hint="Binds a known runner if one exists. Unknown roles use the generic registry runner."
        >
          <select name="role" className={fieldClass} defaultValue="code_reviewer">
            {AGENT_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Domain">
          <select name="domain" className={fieldClass} defaultValue="development">
            {DOMAINS.map((domain) => (
              <option key={domain.value} value={domain.value}>
                {domain.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="Capabilities"
        hint="Comma-separated. Example: review_code, detect_bugs, detect_security_issues"
      >
        <input
          name="capabilities"
          placeholder="review_code, detect_bugs, detect_security_issues"
          className={fieldClass}
        />
      </Field>
      <Field
        label="Tools"
        hint={`Tool Layer: ${layerToolsHint()}. Platform: artifact.write. Everything else is default deny.`}
      >
        <input
          name="tools"
          placeholder="github.read_file, github.search_code, github.get_diff"
          className={fieldClass}
        />
      </Field>
      <Field label="Permissions" hint={PERMISSION_GRANTS.join(", ")}>
        <input name="permissions" placeholder="read_repository" className={fieldClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Model">
          <input name="model" defaultValue={DEFAULT_MODEL} className={fieldClass} />
        </Field>
        <Field label="Risk level">
          <select name="riskLevel" className={fieldClass} defaultValue="low">
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="System prompt">
        <textarea name="systemPrompt" rows={4} className={fieldClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" value="on" defaultChecked className="accent-live" />
        Enabled
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>Register agent</SubmitButton>
      <p className="text-xs text-muted">Example record the orchestrator already seeds:</p>
      <pre className="overflow-x-auto rounded-lg border border-line bg-[#070d14] p-3 font-mono text-[11px] leading-5 text-muted">
        {JSON.stringify(specToPublicJson(CODE_REVIEWER_SPEC), null, 2)}
      </pre>
    </form>
  );
}
