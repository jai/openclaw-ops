export type ReconcileAction = "create" | "update" | "delete" | "unchanged";

export type ReconcileChange = {
  kind: string;
  action: ReconcileAction;
  relativePath: string;
  destination: string;
  source?: string;
  beforeSha256?: string;
  afterSha256?: string;
  mode?: number;
};

export type CommandStep = {
  command: string;
  args: string[];
  cwd?: string;
};

export type ReconcileResult = {
  applied: boolean;
  target: Record<string, string>;
  source: Record<string, string | string[] | undefined>;
  files: ReconcileChange[];
  changed: ReconcileChange[];
  steps: CommandStep[];
};

export function changedFiles(files: ReconcileChange[]): ReconcileChange[] {
  return files.filter((file) => file.action !== "unchanged");
}
