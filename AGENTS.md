# Repository Rules

This is a public-safe OpenClaw operations toolkit.

- Do not add private prompt contents, hostnames, runtime inventories, usernames, secrets, 1Password paths, deploy keys, or organization-specific policy.
- Reconciler commands must dry-run by default and require `--apply` before mutation.
- Deletion/pruning must be explicit and tested.
- Keep examples generic. Use `example-runtime`, `example-agent`, and placeholder repositories.
- Add or update tests with behavior changes.
- Run `npm run verify` before committing.
