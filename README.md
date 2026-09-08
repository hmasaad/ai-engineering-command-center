# AI Engineering Command Center

A single platform for engineering work. Specialist capabilities run **inside** the Command Center. They are not isolated products. Policy, permissions, verification, and risk sit **in front of Execution** — before agents modify code, deploy, access data, or act on production.

```
                    COMMAND CENTER
                          │
             ┌────────────┼────────────┐
             ↓            ↓            ↓
          Projects      Agents       Tasks
                          │
         DEVELOPMENT · OPERATIONS · SECURITY
                          │
              AUTONOMOUS ENGINEERING
                          │
                  ORCHESTRATOR
                       │
                       ↓
                POLICY ENGINE
                       │
                       ↓
                 AGENT RUNTIME
                       │
                       ↓
              AUTONOMOUS WORKFLOW
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
       TOOL EXECUTION        AGENT EXECUTION
             │                   │
             └─────────┬─────────┘
                       ↓
                 VERIFICATION
                       ↓
                 OBSERVABILITY
                       ↓
              RISK / APPROVAL
                       ↓
                  EXECUTION
```

## Phase 1 — Command Center MVP

- Project registration
- GitHub integration (repo lookup, commits, open PRs and issues)
- Agent registry
- Task creation
- Workflow creation
- Agent execution through the orchestrator
- Approval queue
- Execution history

## Phase 2 — Development Intelligence

Services of the Command Center (not standalone agents):

- AI Software Architect
- AI Developer
- PR Reviewer
- Bug Investigation
- Test Generation
- Test Failure Analyzer
- Refactoring
- Technical Debt
- Documentation

## Phase 3 — Security

Services, plus the **policy engine** that every tool request already goes through:

```
Agent → Tool request → Security Gateway → Policy evaluation → Risk score
        → Allow | Deny | Human approval
```

- Prompt Injection Detection
- Agent Hijacking Detection
- RAG Poisoning Detection
- MCP Security
- Data Exfiltration Detection
- Tool Permission Manager
- Security Review Agent
- Agent Security Gateway
- Threat Response Agent

`shell.exec` and `secrets.read` are denied by default. Side-effecting tools (MCP, patches from non-implementers, untrusted corpus) require a human. Detectors can still *read* hostile input.

## Phase 4 — Operations

Services of the Command Center (not a standalone pager):

- Monitoring Agent
- Incident Response Agent
- Log Analysis Agent
- Root Cause Analysis Agent
- Deployment Agent
- Rollback Agent
- Performance Agent
- Recovery Agent

Production-alert playbook:

```
Production Alert → Incident → Logs → Check Deployment → Suspect Commit
  → Bug Investigation → Generate Fix → QA → Security → Human Approval
  → Deploy → Monitor → Verify Resolution
```

## Phase 5 — Observability

Every agent execution is a span under the workflow, not an afterthought:

```
Workflow
 ├── Agent
 │    ├── Input
 │    ├── Context
 │    ├── Tools used
 │    ├── Tool arguments
 │    ├── Output
 │    ├── Tokens
 │    ├── Cost
 │    ├── Duration
 │    └── Risk
 └── Result
```

The Agent Observability dashboard (`/observability`) rolls those spans into live KPIs: active workflows, running agents, awaiting approval, failed workflows, security blocks, success rate, average duration, estimated cost, and human-intervention rate.

Tokens and cost are estimates until specialists are live model calls.

## Phase 6 — Autonomous Engineering

The developer states a goal instead of assigning specialists:

```
Developer
    ↓
"Prepare release 2.4.0"
```

Command Center expands that intent into the Release workflow:

```
Release Workflow
│
├── Analyze Changes
├── Generate Release Notes
├── Architecture Review
├── Code Review
├── Security Scan
├── Test Suite
├── Regression Analysis
├── Build
├── Deployment Risk Analysis
├── Human Approval
├── Deploy
├── Monitor
└── Post-release Verification
```

A hotfix-style intent routes to the Production alert playbook instead. Every step still passes the Agent Security Gateway. Deploy still waits for a human.

## Run

```bash
cp .env.example .env
npm install
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`GITHUB_TOKEN` is optional. Public repositories sync without it. Private repositories and higher rate limits need a token.

## How a run works

1. Register a project and optionally attach `owner/repo`.
2. Open Autonomous and type a goal such as “Prepare release 2.4.0”, or pick a service from Development, Operations, or Security.
3. The **orchestrator** schedules the playbook. The **policy engine** (permissions + detectors) evaluates every tool before the **agent runtime** proceeds.
4. **Tool execution** and **agent execution** fork: gateway-intercepted tools on one side, artifacts on the other. They rejoin at **verification** (tests, regression, post-release checks).
5. **Observability** records the spans. **Risk / approval** is the human gate. Only then does **execution** apply a side effect (deploy, rollback, patch). Reject to halt.

Specialists produce structured artifacts from the task, GitHub snapshot, and upstream steps. Model-backed coding against the linked repo is a later phase.
