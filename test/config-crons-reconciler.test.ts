import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconcileConfig, reconcileCrons } from "../src/index.js";

let tempRoot: string;

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ops-tree-test-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("config reconciler", () => {
  it("plans and applies desired config file changes", async () => {
    const sourceDir = path.join(tempRoot, "desired-config");
    const targetDir = path.join(tempRoot, "target-config");
    await writeFile(path.join(sourceDir, "config.json"), '{"desired":true}\n');
    await writeFile(path.join(targetDir, "config.json"), '{"desired":false}\n');

    const plan = await reconcileConfig({ sourceDir, targetDir });
    expect(plan.applied).toBe(false);
    expect(plan.changed.map((file) => `${file.action}:${file.kind}:${file.relativePath}`)).toEqual([
      "update:config:config.json",
    ]);

    await reconcileConfig({ sourceDir, targetDir, apply: true });
    await expect(fs.readFile(path.join(targetDir, "config.json"), "utf8")).resolves.toBe(
      '{"desired":true}\n',
    );
  });

  it("prunes stale config files only when requested", async () => {
    const sourceDir = path.join(tempRoot, "desired-config");
    const targetDir = path.join(tempRoot, "target-config");
    await writeFile(path.join(sourceDir, "config.json"), '{"desired":true}\n');
    await writeFile(path.join(targetDir, "stale.json"), '{"stale":true}\n');

    const withoutPrune = await reconcileConfig({ sourceDir, targetDir });
    expect(withoutPrune.changed.some((file) => file.action === "delete")).toBe(false);

    const withPrune = await reconcileConfig({ sourceDir, targetDir, prune: true });
    expect(
      withPrune.changed
        .filter((file) => file.action === "delete")
        .map((file) => `${file.kind}:${file.relativePath}`),
    ).toEqual(["config:stale.json"]);
  });
});

describe("cron reconciler", () => {
  it("hard-scopes with --only and ignores unrelated target drift", async () => {
    const sourceDir = path.join(tempRoot, "desired-crons");
    const targetDir = path.join(tempRoot, "target-crons");
    await writeFile(path.join(sourceDir, "hourly/report.md"), "desired report\n");
    await writeFile(path.join(sourceDir, "daily/sync.md"), "desired sync\n");
    await writeFile(path.join(targetDir, "hourly/report.md"), "old report\n");
    await writeFile(path.join(targetDir, "stale.md"), "do not touch\n");

    const result = await reconcileCrons({
      sourceDir,
      targetDir,
      only: ["hourly/report.md"],
      prune: true,
    });

    expect(result.changed.map((file) => `${file.action}:${file.kind}:${file.relativePath}`)).toEqual([
      "update:cron:hourly/report.md",
    ]);
  });

  it("fails clearly when a selected cron artifact is missing", async () => {
    const sourceDir = path.join(tempRoot, "desired-crons");
    const targetDir = path.join(tempRoot, "target-crons");
    await writeFile(path.join(sourceDir, "hourly/report.md"), "desired report\n");

    await expect(
      reconcileCrons({
        sourceDir,
        targetDir,
        only: ["daily/missing.md"],
      }),
    ).rejects.toThrow("Selected source files are missing");
  });
});
