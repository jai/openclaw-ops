# Config Reconciler

`openclaw-ops config reconcile` compares a desired config file tree with one
target runtime config directory.

It is intentionally generic. The caller decides which generated config files
belong in the source directory and where they should land on the runtime.

## Inputs

- `--source-dir`: desired config directory
- `--target-dir`: target config/runtime directory
- `--host`: target host label for audit output
- `--prune`: delete target files absent from source
- `--apply`: write the plan
- `--json`: emit machine-readable output

## Example

```bash
openclaw-ops config reconcile \
  --host example-host \
  --source-dir ./test/fixtures/config-source \
  --target-dir ./tmp/config
```

Apply:

```bash
openclaw-ops config reconcile \
  --host example-host \
  --source-dir ./test/fixtures/config-source \
  --target-dir ./tmp/config \
  --apply
```

## Boundary

This reconciler copies files. It does not render inventory, resolve secrets, or
choose fleet targets. Those decisions belong in the infra repo or scheduler that
calls it.
