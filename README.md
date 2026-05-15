# openclaw-ops

Operational reconcilers for OpenClaw runtimes.

This repo is intentionally generic and public-safe. It contains reusable
reconciler code and examples, not private prompt content, fleet inventory,
hostnames, credentials, or organization-specific deployment policy.

## What belongs here

- Deterministic plan/apply reconcilers for OpenClaw runtime files.
- CLI and library code with JSON output for scheduled automation.
- Generic examples and fixtures with placeholder data.
- Tests for scope handling, dry-run behavior, pruning, and clear failures.

## What does not belong here

- Real prompt bundles or operator instructions.
- Runtime hostnames, usernames, or managed-user inventory.
- Tokens, deploy keys, 1Password paths, or private repository defaults.
- Organization policy that belongs in an infra repo.

## Install

From a checkout:

```bash
npm install
npm run build
npm link
```

For one-off use without linking:

```bash
npm install
npm run build
node dist/cli.js --help
```

## Prompt Reconciler

`openclaw-ops prompts reconcile` compares a rendered prompt bundle with one
OpenClaw runtime agent workspace and optionally applies the difference.

It manages:

- required prompt files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`
- optional prompt file: `USER.md`
- support files under `support/`, copied to a runtime support directory

Dry-run is the default. Use `--apply` to write changes. Deleting stale managed
files is opt-in with `--prune`.

### Use a rendered bundle directory

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

### Pull from a prompt source repo

```bash
openclaw-ops prompts reconcile \
  --repo https://github.com/example/openclaw-prompts.git \
  --ref main \
  --runtime example-runtime \
  --agent main
```

When a checkout has `scripts/render-openclaw-prompts.mjs`, the reconciler runs
it before reading rendered files. Use `--no-render` to skip that step.

### JSON output for schedulers

```bash
openclaw-ops prompts reconcile \
  --source-dir ./test/fixtures/prompt-source/agent-prompts/example-runtime/main \
  --runtime example-runtime \
  --json
```

The JSON includes:

- source metadata: source directory, repo/ref when used, bundle root
- target metadata: runtime id, agent id, workspace dir, support dir
- full file plan and changed file subset
- git/render command steps executed

## Reconciler Contract

All reconcilers in this repo should follow the same contract:

- dry-run by default
- explicit `--apply` for mutations
- deterministic plan output
- `--json` for automation
- clear source and target metadata
- no private defaults
- pruning/deletion is opt-in
- tests cover plan/apply/failure behavior

See [docs/reconciler-contract.md](docs/reconciler-contract.md) for the detailed
contract used by future reconcilers.

## Development

```bash
npm install
npm run verify
```

Build output is written to `dist/`.
