# openclaw-ops

Small, deterministic reconcilers for OpenClaw runtime operations.

`openclaw-ops` is the public-safe tooling layer around OpenClaw runtimes. It
does not contain private prompts, fleet inventory, hostnames, credentials, or
organization policy. Those live in the prompt and infrastructure repositories
that call these reconcilers.

## Reconciler Index

### Prompt Files

Sync rendered agent prompt bundles into one OpenClaw agent workspace.

- CLI: `openclaw-ops prompts reconcile`
- Source: [src/reconcilers/prompts.ts](src/reconcilers/prompts.ts)
- Tests: [test/prompts-reconciler.test.ts](test/prompts-reconciler.test.ts)
- Docs: [docs/reconcilers/prompts.md](docs/reconcilers/prompts.md)
- Manages: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, optional `USER.md`, and `support/` files

```bash
openclaw-ops prompts reconcile \
  --runtime example-runtime \
  --agent main \
  --source-dir ./test/fixtures/prompt-source/agent-prompts/example-runtime/main \
  --workspace-dir ./tmp/workspace \
  --support-dir ./tmp/runtime/example-runtime
```

### Runtime Config

Sync a desired config file tree into one runtime config directory.

- CLI: `openclaw-ops config reconcile`
- Source: [src/reconcilers/config.ts](src/reconcilers/config.ts)
- Shared engine: [src/reconcilers/tree.ts](src/reconcilers/tree.ts)
- Tests: [test/config-crons-reconciler.test.ts](test/config-crons-reconciler.test.ts)
- Docs: [docs/reconcilers/config.md](docs/reconcilers/config.md)
- Manages: caller-selected config files such as `config.json`, model profiles, runtime metadata, or generated desired-config fragments

```bash
openclaw-ops config reconcile \
  --source-dir ./test/fixtures/config-source \
  --target-dir ./tmp/config
```

### Cron Artifacts

Sync desired cron artifacts into one runtime cron directory. The cron reconciler
supports hard scoping with repeated `--only` flags, so schedulers can update
selected cron files without touching unrelated drift.

- CLI: `openclaw-ops crons reconcile`
- Source: [src/reconcilers/crons.ts](src/reconcilers/crons.ts)
- Shared engine: [src/reconcilers/tree.ts](src/reconcilers/tree.ts)
- Tests: [test/config-crons-reconciler.test.ts](test/config-crons-reconciler.test.ts)
- Docs: [docs/reconcilers/crons.md](docs/reconcilers/crons.md)
- Manages: caller-rendered cron definitions, schedules, or launcher artifacts

```bash
openclaw-ops crons reconcile \
  --source-dir ./test/fixtures/cron-source \
  --target-dir ./tmp/crons \
  --only hourly/example.md
```

## Common Behavior

Every reconciler follows the same operational contract:

- dry-run by default
- explicit `--apply` before mutation
- `--json` for scheduler logs and automation
- clear source and target metadata in every result
- deterministic file plans with `create`, `update`, `delete`, and `unchanged`
- pruning/deletion is opt-in with `--prune`
- no private repository, host, user, or credential defaults

See [docs/reconciler-contract.md](docs/reconciler-contract.md) for the detailed
contract.

## Install

From a checkout:

```bash
npm install
npm run build
npm link
```

One-off without linking:

```bash
npm install
npm run build
node dist/cli.js --help
```

## Apply Changes

Dry-run first:

```bash
openclaw-ops config reconcile \
  --source-dir ./test/fixtures/config-source \
  --target-dir ./tmp/config \
  --json
```

Then apply:

```bash
openclaw-ops config reconcile \
  --source-dir ./test/fixtures/config-source \
  --target-dir ./tmp/config \
  --apply
```

Delete stale managed files only when requested:

```bash
openclaw-ops crons reconcile \
  --source-dir ./test/fixtures/cron-source \
  --target-dir ./tmp/crons \
  --prune \
  --apply
```

## Repository Boundary

This repo should stay generic.

Allowed:

- reconciler engines
- CLI wrappers
- public-safe fixtures
- examples with placeholder paths
- tests and docs for generic behavior

Not allowed:

- real prompt bundles or operator instructions
- runtime hostnames, usernames, or managed-user inventory
- tokens, deploy keys, 1Password paths, or private repository defaults
- organization-specific reviewer, CI, or merge policy

## Development

```bash
npm install
npm run verify
```

CI runs the same verification on every push and pull request.
