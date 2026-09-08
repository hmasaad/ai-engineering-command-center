import { ProjectForm } from "@/components/project-form";
import { GhostLink, PageHeader } from "@/components/ui";

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Projects"
        title="Register a project"
        description="Name the system and optionally attach a GitHub repository. The Command Center will pull branch, commit, and PR metadata."
        actions={<GhostLink href="/projects">Back</GhostLink>}
      />
      <ProjectForm />
    </div>
  );
}
