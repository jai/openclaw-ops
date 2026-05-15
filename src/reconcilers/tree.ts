import fs from "node:fs/promises";
import path from "node:path";
import { changedFiles, type ReconcileChange, type ReconcileResult } from "./common.js";
import {
  copyFileAtomic,
  isDirectory,
  listFilesRecursive,
  readSha256,
  resolveHostId,
  resolveUserPath,
} from "../fs-utils.js";

export type FileTreeReconcileOptions = {
  kind: string;
  sourceDir: string;
  targetDir: string;
  hostId?: string;
  apply?: boolean;
  prune?: boolean;
  only?: string[];
  env?: NodeJS.ProcessEnv;
};

export type FileTreeReconcileResult = ReconcileResult & {
  target: {
    hostId: string;
    targetDir: string;
  };
  source: {
    sourceDir: string;
    only?: string[];
  };
};

function normalizeRelativePath(value: string): string {
  const normalized = value.trim().replaceAll("\\", "/");
  if (!normalized) {
    throw new Error("Empty relative path is not allowed");
  }
  if (normalized.startsWith("/") || normalized.includes("..")) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return normalized;
}

async function selectSourceFiles(sourceDir: string, only?: string[]): Promise<string[]> {
  if (!only || only.length === 0) {
    return listFilesRecursive(sourceDir);
  }
  const selected = [...new Set(only.map(normalizeRelativePath))].sort();
  const missing: string[] = [];
  for (const relativePath of selected) {
    const source = path.join(sourceDir, relativePath);
    try {
      const stat = await fs.stat(source);
      if (!stat.isFile()) {
        missing.push(relativePath);
      }
    } catch {
      missing.push(relativePath);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Selected source files are missing: ${missing.join(", ")}`);
  }
  return selected;
}

async function planFileTree(params: {
  kind: string;
  sourceDir: string;
  targetDir: string;
  prune: boolean;
  only?: string[];
}): Promise<ReconcileChange[]> {
  if (!(await isDirectory(params.sourceDir))) {
    throw new Error(`Source directory does not exist: ${params.sourceDir}`);
  }
  const [sourceFiles, targetFiles] = await Promise.all([
    selectSourceFiles(params.sourceDir, params.only),
    params.prune && (!params.only || params.only.length === 0)
      ? listFilesRecursive(params.targetDir)
      : Promise.resolve([]),
  ]);
  const sourceSet = new Set(sourceFiles);
  const changes: ReconcileChange[] = [];

  for (const relativePath of sourceFiles) {
    const source = path.join(params.sourceDir, relativePath);
    const destination = path.join(params.targetDir, relativePath);
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
      kind: params.kind,
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

  for (const relativePath of targetFiles) {
    if (sourceSet.has(relativePath)) {
      continue;
    }
    const destination = path.join(params.targetDir, relativePath);
    changes.push({
      kind: params.kind,
      action: "delete",
      relativePath,
      destination,
      beforeSha256: await readSha256(destination),
    });
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

export async function reconcileFileTree(
  options: FileTreeReconcileOptions,
): Promise<FileTreeReconcileResult> {
  const env = options.env ?? process.env;
  const sourceDir = resolveUserPath(options.sourceDir, env);
  const targetDir = resolveUserPath(options.targetDir, env);
  const hostId = resolveHostId(options.hostId, env);
  const files = await planFileTree({
    kind: options.kind,
    sourceDir,
    targetDir,
    prune: Boolean(options.prune),
    only: options.only,
  });
  const changed = changedFiles(files);
  if (options.apply) {
    for (const change of changed) {
      await applyChange(change);
    }
  }

  return {
    applied: Boolean(options.apply),
    target: { hostId, targetDir },
    source: { sourceDir, only: options.only },
    files,
    changed,
    steps: [],
  };
}
