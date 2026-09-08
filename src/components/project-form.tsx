"use client";

import { useRef, useState } from "react";
import { createProject, previewGithubRepo } from "@/lib/actions";
import type { GithubMeta } from "@/lib/constants";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ProjectForm() {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GithubMeta | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const githubRef = useRef<HTMLInputElement>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    const result = await createProject(formData);
    if (result?.error) setError(result.error);
  }

  async function checkGithub() {
    const value = githubRef.current?.value.trim() || "";
    if (!value) return;
    setChecking(true);
    setPreview(null);
    setPreviewError(null);
    const result = await previewGithubRepo(value);
    setChecking(false);
    if (result.error) setPreviewError(result.error);
    if (result.data) setPreview(result.data);
  }

  return (
    <form action={onSubmit} className="space-y-4 rounded-xl border border-line bg-panel/80 p-5">
      <Field label="Name">
        <input name="name" required placeholder="checkout-service" className={fieldClass} />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          placeholder="What this project is responsible for"
          className={fieldClass}
        />
      </Field>
      <Field
        label="GitHub repository"
        hint="owner/repo or https://github.com/owner/repo. Public repos work without a token."
      >
        <div className="flex gap-2">
          <input
            ref={githubRef}
            name="github"
            placeholder="vercel/next.js"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={checkGithub}
            disabled={checking}
            className="shrink-0 rounded-lg border border-line bg-panel-2 px-3 text-sm disabled:opacity-50"
          >
            {checking ? "Checking…" : "Lookup"}
          </button>
        </div>
      </Field>
      {previewError ? <p className="text-sm text-danger">{previewError}</p> : null}
      {preview ? (
        <div className="rounded-lg border border-line bg-background p-3 text-sm">
          <div className="font-medium">{preview.fullName}</div>
          <p className="mt-1 text-muted">{preview.description || "No description"}</p>
          <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted">
            <span>{preview.visibility}</span>
            <span>{preview.language || "n/a"}</span>
            <span>★ {preview.stars}</span>
            <span>default {preview.defaultBranch}</span>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>Register project</SubmitButton>
    </form>
  );
}
