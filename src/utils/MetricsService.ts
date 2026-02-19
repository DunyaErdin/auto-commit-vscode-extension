import * as vscode from 'vscode';

const KEY_PREFIX = 'autoCommit.metrics.';

export interface MetricsData {
  commitCount: number;
  autoCount: number;
  manualCount: number;
  lastDebounceMs: number;
  avgDebounceMs: number;
  lastCommitTime?: string;
}

export class MetricsService {
  constructor(private context: vscode.ExtensionContext) {}

  private getKey(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  async getCommitCount(): Promise<number> {
    return (await this.context.globalState.get(this.getKey('commitCount'), 0)) as number;
  }

  async getAutoCount(): Promise<number> {
    return (await this.context.globalState.get(this.getKey('autoCount'), 0)) as number;
  }

  async getManualCount(): Promise<number> {
    return (await this.context.globalState.get(this.getKey('manualCount'), 0)) as number;
  }

  async recordCommit(isAuto: boolean): Promise<void> {
    const count = (await this.getCommitCount()) + 1;
    await this.context.globalState.update(this.getKey('commitCount'), count);
    if (isAuto) {
      const auto = (await this.getAutoCount()) + 1;
      await this.context.globalState.update(this.getKey('autoCount'), auto);
    } else {
      const manual = (await this.getManualCount()) + 1;
      await this.context.globalState.update(this.getKey('manualCount'), manual);
    }
    await this.context.globalState.update(
      this.getKey('lastCommitTime'),
      new Date().toISOString()
    );
  }

  async recordDebounce(ms: number): Promise<void> {
    await this.context.globalState.update(this.getKey('lastDebounceMs'), ms);
    const prevAvg = (await this.context.globalState.get(
      this.getKey('avgDebounceMs'),
      0
    )) as number;
    const count = (await this.context.globalState.get(
      this.getKey('debounceCount'),
      0
    )) as number;
    const newCount = count + 1;
    const newAvg = (prevAvg * count + ms) / newCount;
    await this.context.globalState.update(this.getKey('avgDebounceMs'), newAvg);
    await this.context.globalState.update(this.getKey('debounceCount'), newCount);
  }

  async getMetrics(): Promise<MetricsData> {
    return {
      commitCount: await this.getCommitCount(),
      autoCount: await this.getAutoCount(),
      manualCount: await this.getManualCount(),
      lastDebounceMs:
        (await this.context.globalState.get(this.getKey('lastDebounceMs'), 0)) as number,
      avgDebounceMs:
        (await this.context.globalState.get(this.getKey('avgDebounceMs'), 0)) as number,
      lastCommitTime: await this.context.globalState.get(
        this.getKey('lastCommitTime')
      ) as string | undefined,
    };
  }
}
