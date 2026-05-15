# Cron Reconciler

`openclaw-ops crons reconcile` compares desired cron artifacts with one target
cron artifact directory.

It is designed for controller-managed cron files. It does not install system
crontabs, launchd jobs, or systemd timers by itself. The caller should render
the desired artifacts, run this reconciler, then reload/install through its own
host adapter when needed.

## Inputs

- `--source-dir`: desired cron artifact directory
- `--target-dir`: target cron artifact directory
- `--host`: target host label for audit output
- `--only <path>`: limit to one source-relative artifact; repeat as needed
- `--prune`: delete target files absent from source when not using `--only`
- `--apply`: write the plan
- `--json`: emit machine-readable output

## Examples

Dry-run all cron artifacts:

```bash
openclaw-ops crons reconcile \
  --host example-host \
  --source-dir ./test/fixtures/cron-source \
  --target-dir ./tmp/crons
```

Hard-scope to one artifact:

```bash
openclaw-ops crons reconcile \
  --host example-host \
  --source-dir ./test/fixtures/cron-source \
  --target-dir ./tmp/crons \
  --only hourly/example.md
```

Apply and prune the whole target directory:

```bash
openclaw-ops crons reconcile \
  --host example-host \
  --source-dir ./test/fixtures/cron-source \
  --target-dir ./tmp/crons \
  --prune \
  --apply
```

## Hard-Scope Behavior

When `--only` is provided:

- every selected source-relative path must exist
- only selected files are planned
- unrelated target drift is ignored, even when `--prune` is present

This keeps partial cron rollouts narrow and predictable.
