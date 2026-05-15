import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CommandStep } from "./reconcilers/common.js";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export function resolveUserPath(value: string, env: NodeJS.ProcessEnv = process.env): string {
  if (value === "~") {
    return env.HOME ?? os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(env.HOME ?? os.homedir(), value.slice(2));
  }
  return path.resolve(value);
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeAgentId(value: string | undefined): string {
  const raw = optionalString(value) ?? "main";
  const normalized = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized)) {
    throw new Error(`Invalid agent id: ${raw}`);
  }
  return normalized;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

export async function readSha256(filePath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw err;
  }
}

export async function listFilesRecursive(root: string): Promise<string[]> {
  if (!(await isDirectory(root))) {
    return [];
  }
  const out: string[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        out.push(path.relative(root, fullPath));
      }
    }
  }
  return out;
}

export async function copyFileAtomic(
  source: string,
  destination: string,
  mode?: number,
): Promise<void> {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`,
  );
  await fs.copyFile(source, temp);
  if (mode !== undefined) {
    await fs.chmod(temp, mode);
  }
  await fs.rename(temp, destination);
}

export function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; steps?: CommandStep[] },
): Promise<CommandResult> {
  options?.steps?.push({ command, args, cwd: options.cwd });
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit ${code}${detail ? `:\n${detail}` : ""}`,
        ),
      );
    });
  });
}
