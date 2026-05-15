import { reconcileFileTree, type FileTreeReconcileResult } from "./tree.js";

export type CronReconcileOptions = {
  sourceDir: string;
  targetDir: string;
  hostId?: string;
  only?: string[];
  apply?: boolean;
  prune?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type CronReconcileResult = FileTreeReconcileResult;

export async function reconcileCrons(options: CronReconcileOptions): Promise<CronReconcileResult> {
  return reconcileFileTree({
    kind: "cron",
    sourceDir: options.sourceDir,
    targetDir: options.targetDir,
    hostId: options.hostId,
    only: options.only,
    apply: options.apply,
    prune: options.prune,
    env: options.env,
  });
}
