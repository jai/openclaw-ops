import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  reconcilePrompts,
  REQUIRED_PROMPT_FILES,
  resolvePromptReconcileDefaults,
} from "../src/index.js";

let tempRoot: string;

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function createPromptSource(sourceDir: string, options?: { includeUser?: boolean }) {
  for (const fileName of REQUIRED_PROMPT_FILES) {
    await writeFile(path.join(sourceDir, fileName), `${fileName} from source\n`);
  }
  if (options?.includeUser) {
    await writeFile(path.join(sourceDir, "USER.md"), "user prompt\n");
  }
}

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ops-prompts-test-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("prompt reconciler", () => {
  it("uses public-safe defaults without a private prompt repository", () => {
    const defaults = resolvePromptReconcileDefaults({
      agentId: "argus",
      runtimeId: "example-runtime",
      env: { ...process.env, HOME: tempRoot },
    });

    expect(defaults.workspaceDir).toBe(path.join(tempRoot, ".openclaw", "workspace-argus"));
    expect(defaults.supportDir).toBe(
      path.join(tempRoot, ".openclaw", "runtime", "example-runtime-argus"),
    );
  });

  it("requires an explicit source directory or repository", async () => {
    await expect(
      reconcilePrompts({
        runtimeId: "example-runtime",
        env: { ...process.env, HOME: tempRoot, OPENCLAW_PROMPTS_REPO: "" },
      }),
    ).rejects.toThrow("Missing prompt source");
  });

  it("plans prompt and support file updates without applying by default", async () => {
    const sourceDir = path.join(tempRoot, "source");
    const workspaceDir = path.join(tempRoot, "workspace");
    const supportDir = path.join(tempRoot, "runtime", "example-runtime");
    await createPromptSource(sourceDir);
    await writeFile(path.join(sourceDir, "support", "settings.json"), '{"fresh":true}\n');
    await writeFile(path.join(workspaceDir, "AGENTS.md"), "old agents\n");
    await writeFile(path.join(workspaceDir, "USER.md"), "stale user\n");
    await writeFile(path.join(supportDir, "stale.json"), '{"remove":true}\n');

    const result = await reconcilePrompts({
      sourceDir,
      runtimeId: "example-runtime",
      workspaceDir,
      supportDir,
    });

    expect(result.applied).toBe(false);
    expect(
      result.changed.map((file) => `${file.action}:${file.kind}:${file.relativePath}`),
    ).toEqual([
      "update:prompt:AGENTS.md",
      "create:prompt:SOUL.md",
      "create:prompt:TOOLS.md",
      "create:prompt:IDENTITY.md",
      "create:support:settings.json",
    ]);
    await expect(fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf8")).resolves.toBe(
      "old agents\n",
    );
  });

  it("prunes stale managed files only when requested", async () => {
    const sourceDir = path.join(tempRoot, "source");
    const workspaceDir = path.join(tempRoot, "workspace");
    const supportDir = path.join(tempRoot, "runtime", "example-runtime");
    await createPromptSource(sourceDir);
    await writeFile(path.join(workspaceDir, "USER.md"), "stale user\n");
    await writeFile(path.join(supportDir, "stale.json"), '{"remove":true}\n');

    const result = await reconcilePrompts({
      sourceDir,
      runtimeId: "example-runtime",
      workspaceDir,
      supportDir,
      prune: true,
    });

    expect(
      result.changed
        .filter((file) => file.action === "delete")
        .map((file) => `${file.kind}:${file.relativePath}`),
    ).toEqual(["prompt:USER.md", "support:stale.json"]);
  });

  it("applies prompt and support file changes atomically", async () => {
    const sourceDir = path.join(tempRoot, "source");
    const workspaceDir = path.join(tempRoot, "workspace");
    const supportDir = path.join(tempRoot, "runtime", "example-runtime");
    await createPromptSource(sourceDir, { includeUser: true });
    await writeFile(path.join(sourceDir, "support", "settings.json"), '{"fresh":true}\n');

    const result = await reconcilePrompts({
      sourceDir,
      runtimeId: "example-runtime",
      workspaceDir,
      supportDir,
      apply: true,
    });

    expect(result.applied).toBe(true);
    await expect(fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf8")).resolves.toBe(
      "AGENTS.md from source\n",
    );
    await expect(fs.readFile(path.join(workspaceDir, "USER.md"), "utf8")).resolves.toBe(
      "user prompt\n",
    );
    await expect(fs.readFile(path.join(supportDir, "settings.json"), "utf8")).resolves.toBe(
      '{"fresh":true}\n',
    );
  });

  it("fails clearly when a required prompt file is missing", async () => {
    const sourceDir = path.join(tempRoot, "source");
    await createPromptSource(sourceDir);
    await fs.rm(path.join(sourceDir, "TOOLS.md"));

    await expect(
      reconcilePrompts({
        sourceDir,
        runtimeId: "example-runtime",
        workspaceDir: path.join(tempRoot, "workspace"),
        supportDir: path.join(tempRoot, "runtime", "example-runtime"),
      }),
    ).rejects.toThrow("Missing required prompt files");
  });
});
