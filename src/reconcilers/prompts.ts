import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  changedFiles,
  type CommandStep,
  type ReconcileChange,
  type ReconcileResult,
} from "./common.js";
import {
  copyFileAtomic,
  isDirectory,
  listFilesRecursive,
  normalizeAgentId,
  optionalString,
  pathExists,
  readSha256,
  resolveHostId,
  resolveUserPath,
  runCommand,
} from "../fs-utils.js";

export const REQUIRED_PROMPT_FILES = ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md"] as const;
export const OPTIONAL_PROMPT_FILES = ["USER.md"] as const;
export const MANAGED_PROMPT_FILES = [...REQUIRED_PROMPT_FILES, ...OPTIONAL_PROMPT_FILES] as const;

const DEFAULT_REF = "main";
const DEFAULT_BUNDLE_ROOT = "agent-prompts";

export type PromptReconcileOptions = {
  agentId?: string;
  runtimeId?: string;
  hostId?: string;
  repository?: string;
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
  env?: NodeJS.ProcessEnv;
};

export type PromptReconcileDefaults = {
  agentId: string;
  runtimeId: string;
  hostId: string;
  checkoutDir: string;
  bundleRoot: string;
  workspaceDir: string;
  supportDir: string;
};

export type PromptReconcileResult = ReconcileResult & {
  target: {
    hostId: string;
    runtimeId: string;
    agentId: string;
    workspaceDir: string;
    supportDir: string;
  };
  source: {
    sourceDir: string;
    repository?: string;
    ref?: string;
    checkoutDir?: string;
    bundleRoot: string;
  };
};

function normalizeRuntimeId(env: NodeJS.ProcessEnv): string {
  return (
    optionalString(env.OPENCLAW_PROMPTS_RUNTIME) ??
    optionalString(env.OPENCLAW_PROMPT_RUNTIME) ??
    optionalString(env.OPENCLAW_PROFILE) ??
    optionalString(os.userInfo().username) ??
    "default"
  );
}

export function resolvePromptReconcileDefaults(options: {
  agentId?: string;
  runtimeId?: string;
  hostId?: string;
  checkoutDir?: string;
  bundleRoot?: string;
  workspaceDir?: string;
  supportDir?: string;
  env?: NodeJS.ProcessEnv;
}): PromptReconcileDefaults {
  const env = options.env ?? process.env;
  const home = env.HOME ?? os.homedir();
  const openclawDir = path.join(home, ".openclaw");
  const agentId = normalizeAgentId(options.agentId);
  const runtimeId = optionalString(options.runtimeId) ?? normalizeRuntimeId(env);
  const hostId = resolveHostId(options.hostId, env);
  const checkoutDir =
    optionalString(options.checkoutDir) ??
    optionalString(env.OPENCLAW_PROMPTS_CHECKOUT_DIR) ??
    path.join(openclawDir, "prompt-source", "openclaw-prompts");
  const bundleRoot =
    optionalString(options.bundleRoot) ??
    optionalString(env.OPENCLAW_PROMPTS_BUNDLE_ROOT) ??
    DEFAULT_BUNDLE_ROOT;
  const workspaceDir =
    optionalString(options.workspaceDir) ??
    (agentId === "main"
      ? path.join(openclawDir, "workspace")
      : path.join(openclawDir, `workspace-${agentId}`));
  const supportRoot = agentId === "main" ? runtimeId : `${runtimeId}-${agentId}`;
  const supportDir =
    optionalString(options.supportDir) ?? path.join(openclawDir, "runtime", supportRoot);

  return {
    agentId,
    runtimeId,
    hostId,
    checkoutDir: resolveUserPath(checkoutDir, env),
    bundleRoot,
    workspaceDir: resolveUserPath(workspaceDir, env),
    supportDir: resolveUserPath(supportDir, env),
  };
}

async function ensurePromptSourceCheckout(params: {
  repository: string;
  ref: string;
  checkoutDir: string;
  pull: boolean;
  allowDirtyCheckout: boolean;
  env: NodeJS.ProcessEnv;
  steps: CommandStep[];
}): Promise<void> {
  if (!params.pull && (await isDirectory(params.checkoutDir))) {
    return;
  }

  if (!(await pathExists(params.checkoutDir))) {
    if (!params.pull) {
      throw new Error(
        `Prompt checkout does not exist: ${params.checkoutDir}. Use --pull or provide --source-dir.`,
      );
    }
    await fs.mkdir(path.dirname(params.checkoutDir), { recursive: true });
    await runCommand("git", ["clone", params.repository, params.checkoutDir], {
      env: params.env,
      steps: params.steps,
    });
  }

  if (!(await isDirectory(path.join(params.checkoutDir, ".git")))) {
    throw new Error(`Prompt checkout is not a git repository: ${params.checkoutDir}`);
  }

  const status = await runCommand("git", ["status", "--porcelain"], {
    cwd: params.checkoutDir,
    env: params.env,
  });
  if (status.stdout.trim() && !params.allowDirtyCheckout) {
    throw new Error(
      `Prompt checkout has local changes: ${params.checkoutDir}. Commit, clean, or use --allow-dirty-checkout.`,
    );
  }

  if (!params.pull) {
    return;
  }

  try {
    await runCommand("git", ["fetch", "origin", params.ref, "--depth=1"], {
      cwd: params.checkoutDir,
      env: params.env,
      steps: params.steps,
    });
  } catch {
    await runCommand("git", ["fetch", "origin", "--depth=1"], {
      cwd: params.checkoutDir,
      env: params.env,
      steps: params.steps,
    });
  }
  await runCommand("git", ["checkout", params.ref], {
    cwd: params.checkoutDir,
    env: params.env,
    steps: params.steps,
  });
  try {
    await runCommand("git", ["reset", "--hard", `origin/${params.ref}`], {
      cwd: params.checkoutDir,
      env: params.env,
      steps: params.steps,
    });
  } catch {
    await runCommand("git", ["checkout", "--detach", params.ref], {
      cwd: params.checkoutDir,
      env: params.env,
      steps: params.steps,
    });
  }
}

async function renderPromptSource(params: {
  checkoutDir: string;
  render: boolean;
  env: NodeJS.ProcessEnv;
  steps: CommandStep[];
}): Promise<void> {
  if (!params.render) {
    return;
  }
  const scriptPath = path.join(params.checkoutDir, "scripts", "render-openclaw-prompts.mjs");
  if (!(await pathExists(scriptPath))) {
    return;
  }
  await runCommand(process.execPath, [scriptPath, "--write", "--repo-root", params.checkoutDir], {
    cwd: params.checkoutDir,
    env: params.env,
    steps: params.steps,
  });
}

async function validatePromptSourceDir(sourceDir: string): Promise<void> {
  const missing: string[] = [];
  for (const fileName of REQUIRED_PROMPT_FILES) {
    if (!(await pathExists(path.join(sourceDir, fileName)))) {
      missing.push(fileName);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required prompt files in ${sourceDir}: ${missing.join(", ")}`);
  }
}

async function planPromptFiles(params: {
  sourceDir: string;
  workspaceDir: string;
  prune: boolean;
}): Promise<ReconcileChange[]> {
  const changes: ReconcileChange[] = [];
  for (const fileName of MANAGED_PROMPT_FILES) {
    const source = path.join(params.sourceDir, fileName);
    const destination = path.join(params.workspaceDir, fileName);
    const sourceSha = await readSha256(source);
    const destinationSha = await readSha256(destination);
    if (sourceSha) {
      changes.push({
        kind: "prompt",
        action:
          destinationSha === undefined
            ? "create"
            : destinationSha === sourceSha
              ? "unchanged"
              : "update",
        relativePath: fileName,
        source,
        destination,
        beforeSha256: destinationSha,
        afterSha256: sourceSha,
      });
      continue;
    }
    if (params.prune && destinationSha !== undefined) {
      changes.push({
        kind: "prompt",
        action: "delete",
        relativePath: fileName,
        destination,
        beforeSha256: destinationSha,
      });
    }
  }
  return changes;
}

async function planSupportFiles(params: {
  sourceDir: string;
  supportDir: string;
  prune: boolean;
}): Promise<ReconcileChange[]> {
  const sourceSupportDir = path.join(params.sourceDir, "support");
  const [sourceFiles, destinationFiles] = await Promise.all([
    listFilesRecursive(sourceSupportDir),
    params.prune ? listFilesRecursive(params.supportDir) : Promise.resolve([]),
  ]);
  const sourceSet = new Set(sourceFiles);
  const changes: ReconcileChange[] = [];

  for (const relativePath of sourceFiles) {
    const source = path.join(sourceSupportDir, relativePath);
    const destination = path.join(params.supportDir, relativePath);
    const [sourceSha, destinationSha, stat] = await Promise.all([
      readSha256(source),
      readSha256(destination),
      fs.stat(source),
    ]);
    if (!sourceSha) {
      continue;
    }
    const mode = (stat.mode & 0o111) !== 0 ? 0o755 : 0o644;
    changes.push({
      kind: "support",
      action:
        destinationSha === undefined
          ? "create"
          : destinationSha === sourceSha
            ? "unchanged"
            : "update",
      relativePath,
      source,
      destination,
      beforeSha256: destinationSha,
      afterSha256: sourceSha,
      mode,
    });
  }

  for (const relativePath of destinationFiles) {
    if (!sourceSet.has(relativePath)) {
      const destination = path.join(params.supportDir, relativePath);
      changes.push({
        kind: "support",
        action: "delete",
        relativePath,
        destination,
        beforeSha256: await readSha256(destination),
      });
    }
  }

  return changes;
}

async function applyChange(change: ReconcileChange): Promise<void> {
  if (change.action === "unchanged") {
    return;
  }
  if (change.action === "delete") {
    await fs.rm(change.destination, { force: true });
    return;
  }
  if (!change.source) {
    throw new Error(`Missing source for ${change.relativePath}`);
  }
  await copyFileAtomic(change.source, change.destination, change.mode);
}

export async function reconcilePrompts(
  options: PromptReconcileOptions,
): Promise<PromptReconcileResult> {
  const env = options.env ?? process.env;
  const defaults = resolvePromptReconcileDefaults({
    agentId: options.agentId,
    runtimeId: options.runtimeId,
    hostId: options.hostId,
    checkoutDir: options.checkoutDir,
    bundleRoot: options.bundleRoot,
    workspaceDir: options.workspaceDir,
    supportDir: options.supportDir,
    env,
  });
  const repository =
    optionalString(options.repository) ?? optionalString(env.OPENCLAW_PROMPTS_REPO);
  const ref = optionalString(options.ref) ?? optionalString(env.OPENCLAW_PROMPTS_REF) ?? DEFAULT_REF;
  const apply = Boolean(options.apply);
  const pull = options.pull !== false;
  const render = options.render !== false;
  const prune = Boolean(options.prune);
  const steps: CommandStep[] = [];

  if (!options.sourceDir) {
    if (!repository) {
      throw new Error("Missing prompt source. Provide --source-dir or --repo.");
    }
    await ensurePromptSourceCheckout({
      repository,
      ref,
      checkoutDir: defaults.checkoutDir,
      pull,
      allowDirtyCheckout: Boolean(options.allowDirtyCheckout),
      env,
      steps,
    });
    await renderPromptSource({ checkoutDir: defaults.checkoutDir, render, env, steps });
  }

  const sourceDir = resolveUserPath(
    optionalString(options.sourceDir) ??
      path.join(defaults.checkoutDir, defaults.bundleRoot, defaults.runtimeId, defaults.agentId),
    env,
  );
  await validatePromptSourceDir(sourceDir);

  const files = [
    ...(await planPromptFiles({
      sourceDir,
      workspaceDir: defaults.workspaceDir,
      prune,
    })),
    ...(await planSupportFiles({
      sourceDir,
      supportDir: defaults.supportDir,
      prune,
    })),
  ];
  const changed = changedFiles(files);
  if (apply) {
    for (const change of changed) {
      await applyChange(change);
    }
  }

  return {
    applied: apply,
    target: {
      hostId: defaults.hostId,
      runtimeId: defaults.runtimeId,
      agentId: defaults.agentId,
      workspaceDir: defaults.workspaceDir,
      supportDir: defaults.supportDir,
    },
    source: {
      sourceDir,
      repository: options.sourceDir ? undefined : repository,
      ref: options.sourceDir ? undefined : ref,
      checkoutDir: options.sourceDir ? undefined : defaults.checkoutDir,
      bundleRoot: defaults.bundleRoot,
    },
    files,
    changed,
    steps,
  };
}
