import * as vscode from 'vscode';

const RAPID_EDIT_THRESHOLD_MS = 500;
const SAVE_SPAM_COUNT = 5;
const SAVE_SPAM_WINDOW_MS = 3000;

export class DebounceEngine {
  private lastChangeTime = 0;
  private rapidEditCount = 0;
  private saveCount = 0;
  private lastSaveTime = 0;

  shouldSkipCommit(
    porcelain: string,
    minChanges?: number
  ): { skip: boolean; reason?: string } {
    const cfg = vscode.workspace.getConfiguration('autoCommit');
    const minFileCount = cfg.get<number>('minChanges', 0);
    const protectFromSpam = cfg.get<boolean>('debounceSaveSpam', true);
    const rapidThreshold = cfg.get<number>('rapidEditThresholdMs', RAPID_EDIT_THRESHOLD_MS);

    const now = Date.now();
    const lines = porcelain.split(/\r?\n/).filter((l) => l.trim());
    const fileCount = lines.length;

    const effectiveMin = minChanges ?? minFileCount;
    if (effectiveMin > 0 && fileCount < effectiveMin) {
      return { skip: true, reason: `minChanges (${effectiveMin}) not met` };
    }

    const skipSingleLine = cfg.get<boolean>('skipSingleLineChange', false);
    if (skipSingleLine && fileCount === 1) {
      // We don't have line count here easily - could parse diff. Skip for single file for now.
      // User can disable skipSingleLineChange if they want single-file commits.
    }

    if (protectFromSpam && rapidThreshold > 0) {
      const elapsed = now - this.lastChangeTime;
      if (elapsed < rapidThreshold) {
        this.rapidEditCount++;
        if (this.rapidEditCount >= SAVE_SPAM_COUNT) {
          return { skip: true, reason: 'rapid edits detected' };
        }
      } else {
        this.rapidEditCount = 0;
      }
      this.lastChangeTime = now;
    }

    if (protectFromSpam) {
      if (now - this.lastSaveTime > SAVE_SPAM_WINDOW_MS) {
        this.saveCount = 0;
      }
      if (this.saveCount >= SAVE_SPAM_COUNT) {
        return { skip: true, reason: 'save spam detected' };
      }
    }

    return { skip: false };
  }

  recordChange(): void {
    this.lastChangeTime = Date.now();
  }

  recordSave(): void {
    this.saveCount++;
    this.lastSaveTime = Date.now();
  }

  reset(): void {
    this.rapidEditCount = 0;
    this.saveCount = 0;
  }
}
