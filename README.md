# OpenClaw Ops

![CI](https://github.com/jai/openclaw-ops/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D22.16-339933)

Deterministic, public-safe reconcilers for OpenClaw runtime operations.

OpenClaw Ops gives schedulers and infra repos a small set of boring, auditable
commands for keeping runtime files aligned with rendered desired state. It owns
the mechanics: plan, diff, apply, JSON logs, and safety rails. Your private
prompt repos and infra repos still own the actual desired state, hosts,
credentials, schedules, and rollout policy.

## ✨ Why It Exists

OpenClaw runtimes accumulate local drift: prompt files get hotpatched, generated
config changes, cron artifacts move, and support files need to follow the active
agent. These tools make that drift visible first, then fix it only when the
caller explicitly asks.

Every reconciler is:

- dry-run by default
- explicit about source and target paths
- JSON-friendly for automation logs
- safe to run against one runtime target at a time
- generic enough for public reuse

## 🧰 Reconciler Catalog

| Reconciler | Command | What it syncs | Docs | Code |
| --- | --- | --- | --- | --- |
| Prompt Files | `openclaw-ops prompts reconcile` | Rendered agent prompts and `support/` files into one OpenClaw agent workspace | [docs/reconcilers/prompts.md](docs/reconcilers/prompts.md) | [src/reconcilers/prompts.ts](src/reconcilers/prompts.ts) |
| Runtime Config | `openclaw-ops config reconcile` | Desired config file trees into one runtime config directory | [docs/reconcilers/config.md](docs/reconcilers/config.md) | [src/reconcilers/config.ts](src/reconcilers/config.ts) |
| Cron Artifacts | `openclaw-ops crons reconcile` | Desired cron artifacts into one runtime cron directory, with `--only` hard scoping | [docs/reconcilers/crons.md](docs/reconcilers/crons.md) | [src/reconcilers/crons.ts](src/reconcilers/crons.ts) |

Shared file-tree planning lives in [src/reconcilers/tree.ts](src/reconcilers/tree.ts).
Behavior coverage lives in [test/prompts-reconciler.test.ts](test/prompts-reconciler.test.ts)
and [test/config-crons-reconciler.test.ts](test/config-crons-reconciler.test.ts).

## 🚦 Common Contract

All reconcilers follow the same operating model:

- `dry-run` is the default
- `--apply` is required before mutation
- `--json` emits scheduler-friendly machine output
- `--prune` is required before deleting stale managed files
- results include source metadata, target metadata, full file plan, and changed files
- missing or invalid desired state fails before mutation
- no private repository, host, user, token, or credential defaults

See [docs/reconciler-contract.md](docs/reconciler-contract.md) for the full contract.

## ⚡ Quick Start

```bash
npm install
npm run build
node dist/cli.js --help
```

Link the CLI while developing locally:

```bash
npm link
openclaw-ops --help
```

## 📝 Prompt Files

Use this when a rendered prompt bundle should become the live prompt files for
one OpenClaw runtime agent.

```bash
openclaw-ops prompts reconcile \
  --runtime example-runtime \
  --agent main \
  --source-dir ./test/fixtures/prompt-source/agent-prompts/example-runtime/main \
  --workspace-dir ./tmp/workspace \
  --support-dir ./tmp/runtime/example-runtime
```

Apply the same plan:

```bash
openclaw-ops prompts reconcile \
  --runtime example-runtime \
  --agent main \
  --source-dir ./test/fixtures/prompt-source/agent-prompts/example-runtime/main \
  --workspace-dir ./tmp/workspace \
  --support-dir ./tmp/runtime/example-runtime \
  --apply
```

## ⚙️ Runtime Config

Use this when an infra repo has rendered a desired config directory and the
runtime should match it.

```bash
openclaw-ops config reconcile \
  --source-dir ./test/fixtures/config-source \
  --target-dir ./tmp/config \
  --json
```

Apply:

```bash
openclaw-ops config reconcile \
  --source-dir ./test/fixtures/config-source \
  --target-dir ./tmp/config \
  --apply
```

## ⏱️ Cron Artifacts

Use this when a scheduler or infra repo has rendered cron artifacts for a
runtime. `--only` keeps partial rollouts narrow and ignores unrelated drift.

```bash
openclaw-ops crons reconcile \
  --source-dir ./test/fixtures/cron-source \
  --target-dir ./tmp/crons \
  --only hourly/example.md
```

Apply and prune the whole target directory:

```bash
openclaw-ops crons reconcile \
  --source-dir ./test/fixtures/cron-source \
  --target-dir ./tmp/crons \
  --prune \
  --apply
```

## 🧱 Repository Boundary

This repo is public. Keep it generic.

Good fits:

- reconciler engines
- CLI wrappers
- generic fixtures
- placeholder examples
- tests and docs for generic behavior

Keep out:

- real prompt bundles or operator instructions
- runtime hostnames, usernames, or managed-user inventory
- tokens, deploy keys, 1Password paths, or private repository defaults
- organization-specific reviewer, CI, merge, or rollout policy

## 🛠️ Development

```bash
npm install
npm run verify
```

CI runs the same verification on every push and pull request.
