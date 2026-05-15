# Reconciler Contract

Reconcilers in this repo are small deterministic tools that compare a desired
source with one OpenClaw runtime target.

## Required CLI Behavior

- Default to dry-run.
- Mutate only with `--apply`.
- Emit machine-readable output with `--json`.
- Include source metadata in every result.
- Include target metadata in every result.
- Include a target host label in every result. Use `--host`, `OPENCLAW_HOST`,
  or the local hostname default.
- Include the full file plan and changed-file subset.
- Fail before mutating when the source is incomplete or invalid.
- Make deletion opt-in. A caller must pass an explicit prune/delete option.

## Scope

Each reconciler should operate on one concrete target per invocation. Fleet
selection, host inventory, credentials, and schedules belong in the calling
infra system, not inside the reconciler.

## Source Boundaries

Public code must not assume a private source repository. Repos, refs, checkout
paths, bundle roots, and auth must be passed by CLI flags or environment.

## Apply Semantics

Apply should be idempotent:

- unchanged files are skipped
- creates and updates use atomic replacement where practical
- deletes remove only files explicitly listed in the plan
- support-file modes preserve executable bit as `755`, otherwise `644`

## Scheduling

Schedulers should store JSON output for auditability. A typical scheduled run
first executes a dry-run, evaluates changed files, then executes with `--apply`
only when the caller's policy permits mutation.
