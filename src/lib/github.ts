import { Octokit } from "octokit";
import type {
  GithubMeta,
  IssueDetail,
  PullRequestDetail,
} from "@/lib/constants";

export function parseGithubRepo(input: string) {
  const trimmed = input.trim().replace(/\.git$/i, "");
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /github\.com[:/]+([^/\s]+)\/([^/\s?#]+)/i,
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  const short = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (short) {
    return { owner: short[1], repo: short[2] };
  }

  return null;
}

export function parseFocusNumber(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function octokit() {
  const token = process.env.GITHUB_TOKEN?.trim();
  return new Octokit(token ? { auth: token } : {});
}

function githubError(error: unknown): never {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
  if (status === 404) {
    throw new Error(
      "Repository not found. If it is private, add a GITHUB_TOKEN to .env.",
    );
  }
  if (status === 401 || status === 403) {
    throw new Error(
      "GitHub rejected the request. Check GITHUB_TOKEN or wait for rate limits to reset.",
    );
  }
  throw new Error(
    error instanceof Error ? error.message : "GitHub lookup failed.",
  );
}

export async function fetchGithubRepo(
  owner: string,
  repo: string,
): Promise<GithubMeta> {
  const client = octokit();

  try {
    const { data } = await client.rest.repos.get({ owner, repo });

    const [commitsResult, prsResult, issuesResult] = await Promise.allSettled([
      client.rest.repos.listCommits({ owner, repo, per_page: 8 }),
      client.rest.pulls.list({ owner, repo, state: "open", per_page: 8 }),
      client.rest.issues.listForRepo({
        owner,
        repo,
        state: "open",
        per_page: 12,
      }),
    ]);

    const commits =
      commitsResult.status === "fulfilled"
        ? commitsResult.value.data.map((commit) => ({
            sha: commit.sha.slice(0, 7),
            message: (commit.commit.message || "").split("\n")[0],
            author:
              commit.commit.author?.name ||
              commit.author?.login ||
              "unknown",
            date: commit.commit.author?.date || "",
            url: commit.html_url,
          }))
        : [];

    const pullRequests =
      prsResult.status === "fulfilled"
        ? prsResult.value.data.map((pr) => ({
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            user: pr.user?.login || "unknown",
            body: pr.body ? pr.body.slice(0, 400) : undefined,
          }))
        : [];

    const issues =
      issuesResult.status === "fulfilled"
        ? issuesResult.value.data
            .filter((issue) => !issue.pull_request)
            .slice(0, 8)
            .map((issue) => ({
              number: issue.number,
              title: issue.title,
              url: issue.html_url,
              user: issue.user?.login || "unknown",
              labels: (issue.labels || [])
                .map((label) =>
                  typeof label === "string" ? label : label.name || "",
                )
                .filter(Boolean),
            }))
        : [];

    return {
      fullName: data.full_name,
      description: data.description,
      htmlUrl: data.html_url,
      defaultBranch: data.default_branch,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      visibility: data.private ? "private" : "public",
      pushedAt: data.pushed_at,
      commits,
      pullRequests,
      issues,
    };
  } catch (error) {
    githubError(error);
  }
}

export async function fetchPullRequest(
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestDetail> {
  const client = octokit();
  try {
    const [{ data: pr }, filesResult] = await Promise.all([
      client.rest.pulls.get({ owner, repo, pull_number: number }),
      client.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: number,
        per_page: 20,
      }),
    ]);

    return {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      url: pr.html_url,
      user: pr.user?.login || "unknown",
      state: pr.draft ? "draft" : pr.state,
      base: pr.base.ref,
      head: pr.head.ref,
      files: filesResult.data.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      })),
    };
  } catch (error) {
    githubError(error);
  }
}

export async function fetchIssue(
  owner: string,
  repo: string,
  number: number,
): Promise<IssueDetail> {
  const client = octokit();
  try {
    const { data } = await client.rest.issues.get({
      owner,
      repo,
      issue_number: number,
    });
    return {
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      url: data.html_url,
      user: data.user?.login || "unknown",
      state: data.state,
      labels: (data.labels || [])
        .map((label) => (typeof label === "string" ? label : label.name || ""))
        .filter(Boolean),
    };
  } catch (error) {
    githubError(error);
  }
}
