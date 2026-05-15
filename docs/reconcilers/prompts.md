# Prompt Reconciler

`openclaw-ops prompts reconcile` compares a rendered prompt bundle with one
OpenClaw agent workspace.

## Inputs

- `--source-dir`: already-rendered bundle directory for one runtime/agent
- or `--repo` plus `--ref`: prompt source repository and ref
- `--runtime`: runtime/user id used in source bundle paths
- `--host`: target host label for audit output
- `--agent`: OpenClaw agent id, default `main`
- `--workspace-dir`: target agent workspace directory
- `--support-dir`: target runtime support directory

When using `--repo`, the command reads rendered files from:

```text
<checkout>/<bundle-root>/<runtime>/<agent>
```

Default `--bundle-root` is `agent-prompts`.

## Managed Files

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- optional `USER.md`
- files under `support/`

## Examples

Dry-run from a rendered bundle:

```bash
openclaw-ops prompts reconcile \
  --host example-host \
  --runtime example-runtime \
  --agent main \
  --source-dir ./test/fixtures/prompt-source/agent-prompts/example-runtime/main \
  --workspace-dir ./tmp/workspace \
  --support-dir ./tmp/runtime/example-runtime
```

Apply the same plan:

```bash
openclaw-ops prompts reconcile \
  --host example-host \
  --runtime example-runtime \
  --agent main \
  --source-dir ./test/fixtures/prompt-source/agent-prompts/example-runtime/main \
  --workspace-dir ./tmp/workspace \
  --support-dir ./tmp/runtime/example-runtime \
  --apply
```

Pull from a prompt source repository:

```bash
openclaw-ops prompts reconcile \
  --host example-host \
  --repo https://github.com/example/openclaw-prompts.git \
  --ref main \
  --runtime example-runtime \
  --agent main
```

## Notes

If the checkout contains `scripts/render-openclaw-prompts.mjs`, the reconciler
runs it before reading rendered files. Use `--no-render` to skip that step.
