#!/usr/bin/env node
import { Command } from "commander";
import { reconcileConfig } from "./reconcilers/config.js";
import { reconcileCrons } from "./reconcilers/crons.js";
import { reconcilePrompts, type PromptReconcileResult } from "./reconcilers/prompts.js";
import type { ReconcileResult } from "./reconcilers/common.js";

type PromptCliOptions = {
  agent?: string;
  runtime?: string;
  host?: string;
  repo?: string;
  ref?: string;
  checkoutDir?: string;
  sourceDir?: string;
  bundleRoot?: string;
  workspaceDir?: string;
  supportDir?: string;
  apply?: boolean;
  pull?: boolean;
  render?: boolean;
  prune?: boolean;
  allowDirtyCheckout?: boolean;
  json?: boolean;
};

type TreeCliOptions = {
  host?: string;
  sourceDir?: string;
  targetDir?: string;
  apply?: boolean;
  prune?: boolean;
  json?: boolean;
};

type CronCliOptions = TreeCliOptions & {
  only?: string[];
};

function formatPathList(paths: string[]): string {
  return paths.length === 0 ? "none" : paths.join(", ");
}

export function formatResult(result: ReconcileResult, label: string): string {
  const changed = result.changed;
  const created = changed
    .filter((file) => file.action === "create")
    .map((file) => `${file.kind}:${file.relativePath}`);
  const updated = changed
    .filter((file) => file.action === "update")
    .map((file) => `${file.kind}:${file.relativePath}`);
  const deleted = changed
    .filter((file) => file.action === "delete")
    .map((file) => `${file.kind}:${file.relativePath}`);
  const mode = result.applied ? "applied" : "dry-run";
  const targetLines = Object.entries(result.target).map(([key, value]) => `${key}: ${value}`);
  const sourceLines = Object.entries(result.source)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
  const lines = [
    `${label} reconcile ${mode}`,
    ...sourceLines,
    ...targetLines,
    `created: ${formatPathList(created)}`,
    `updated: ${formatPathList(updated)}`,
    `deleted: ${formatPathList(deleted)}`,
  ];
  if (!result.applied && changed.length > 0) {
    lines.push("run with --apply to write these changes");
  }
  return lines.join("\n");
}

export function formatPromptResult(result: PromptReconcileResult): string {
  return formatResult(result, `Prompt ${result.target.runtimeId}/${result.target.agentId}`);
}

function requireOption(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required option: ${name}`);
  }
  return value;
}

export function buildProgram(): Command {
  const program = new Command()
    .name("openclaw-ops")
    .description("Operational reconcilers for OpenClaw runtimes")
    .version("0.1.0");

  const prompts = program
    .command("prompts")
    .description("Reconcile rendered prompt bundles into OpenClaw runtime paths");

  prompts
    .command("reconcile")
    .description("Plan or apply prompt and support file changes for one runtime agent")
    .option("--agent <id>", "Target agent id", "main")
    .option("--host <name>", "Target host label for audit output")
    .option(
      "--runtime <id>",
      "Rendered prompt runtime/user id; defaults to env/runtime username",
    )
    .option("--repo <url>", "Prompt source git repository; required unless --source-dir is set")
    .option("--ref <ref>", "Prompt source git ref", "main")
    .option("--checkout-dir <path>", "Managed prompt source checkout directory")
    .option("--source-dir <path>", "Already-rendered prompt bundle directory; skips git/render")
    .option("--bundle-root <path>", "Rendered prompt bundle root inside checkout", "agent-prompts")
    .option("--workspace-dir <path>", "Target agent workspace directory")
    .option("--support-dir <path>", "Target runtime support directory")
    .option("--apply", "Write changes instead of dry-running", false)
    .option("--no-pull", "Do not fetch/update the prompt source checkout")
    .option("--no-render", "Do not run scripts/render-openclaw-prompts.mjs when present")
    .option("--prune", "Delete managed prompt/support files absent from the source", false)
    .option(
      "--allow-dirty-checkout",
      "Allow prompt source checkout local changes before updating",
      false,
    )
    .option("--json", "Output JSON", false)
    .action(async (opts: PromptCliOptions) => {
      try {
        const result = await reconcilePrompts({
          agentId: opts.agent,
          runtimeId: opts.runtime,
          hostId: opts.host,
          repository: opts.repo,
          ref: opts.ref,
          checkoutDir: opts.checkoutDir,
          sourceDir: opts.sourceDir,
          bundleRoot: opts.bundleRoot,
          workspaceDir: opts.workspaceDir,
          supportDir: opts.supportDir,
          apply: Boolean(opts.apply),
          pull: opts.pull !== false,
          render: opts.render !== false,
          prune: Boolean(opts.prune),
          allowDirtyCheckout: Boolean(opts.allowDirtyCheckout),
        });
        process.stdout.write(
          opts.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatPromptResult(result)}\n`,
        );
      } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
        process.exitCode = 1;
      }
    });

  const config = program
    .command("config")
    .description("Reconcile desired runtime config files into a target config directory");

  config
    .command("reconcile")
    .description("Plan or apply desired runtime config file changes")
    .option("--host <name>", "Target host label for audit output")
    .requiredOption("--source-dir <path>", "Desired config directory")
    .requiredOption("--target-dir <path>", "Target OpenClaw config/runtime directory")
    .option("--apply", "Write changes instead of dry-running", false)
    .option("--prune", "Delete target files absent from the source", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: TreeCliOptions) => {
      try {
        const result = await reconcileConfig({
          sourceDir: requireOption(opts.sourceDir, "--source-dir"),
          targetDir: requireOption(opts.targetDir, "--target-dir"),
          hostId: opts.host,
          apply: Boolean(opts.apply),
          prune: Boolean(opts.prune),
        });
        process.stdout.write(
          opts.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatResult(result, "Config")}\n`,
        );
      } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
        process.exitCode = 1;
      }
    });

  const crons = program
    .command("crons")
    .description("Reconcile desired cron artifacts into a target cron directory");

  crons
    .command("reconcile")
    .description("Plan or apply desired cron artifact changes")
    .option("--host <name>", "Target host label for audit output")
    .requiredOption("--source-dir <path>", "Desired cron artifact directory")
    .requiredOption("--target-dir <path>", "Target cron artifact directory")
    .option(
      "--only <path>",
      "Limit reconciliation to one source-relative cron artifact; repeat for multiple files",
      (value, previous: string[] = []) => [...previous, value],
      [],
    )
    .option("--apply", "Write changes instead of dry-running", false)
    .option("--prune", "Delete target files absent from the source when not using --only", false)
    .option("--json", "Output JSON", false)
    .action(async (opts: CronCliOptions) => {
      try {
        const result = await reconcileCrons({
          sourceDir: requireOption(opts.sourceDir, "--source-dir"),
          targetDir: requireOption(opts.targetDir, "--target-dir"),
          hostId: opts.host,
          only: opts.only,
          apply: Boolean(opts.apply),
          prune: Boolean(opts.prune),
        });
        process.stdout.write(
          opts.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatResult(result, "Crons")}\n`,
        );
      } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
        process.exitCode = 1;
      }
    });

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildProgram().parseAsync(process.argv);
}
