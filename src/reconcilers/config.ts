import { reconcileFileTree, type FileTreeReconcileResult } from "./tree.js";

export type ConfigReconcileOptions = {
  sourceDir: string;
  targetDir: string;
  hostId?: string;
  apply?: boolean;
  prune?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type ConfigReconcileResult = FileTreeReconcileResult;

export async function reconcileConfig(
  options: ConfigReconcileOptions,
): Promise<ConfigReconcileResult> {
  return reconcileFileTree({
    kind: "config",
    sourceDir: options.sourceDir,
    targetDir: options.targetDir,
    hostId: options.hostId,
    apply: options.apply,
    prune: options.prune,
    env: options.env,
  });
}
