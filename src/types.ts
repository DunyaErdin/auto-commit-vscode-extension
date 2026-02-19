

export type CommitMode = 'safe' | 'auto' | 'manual';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type GitStatusXY = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?' | '!';

export interface PorcelainEntry {
  xy: string;
  path: string;
  renameTo?: string;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  files: number;
}

export interface CommitPreviewData {
  changedFiles: PorcelainEntry[];
  diffSummary: DiffSummary;
  generatedMessage: string;
  branch: string;
}

export interface CommitMessageProvider {
  generate(files: string[], diff?: string, branch?: string): Promise<string>;
}
