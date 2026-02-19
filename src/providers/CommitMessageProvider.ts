import type { CommitMessageProvider as ICommitMessageProvider } from '../types';
import { ChangeAnalyzer } from '../core/ChangeAnalyzer';

export class DefaultHeuristicProvider implements ICommitMessageProvider {
  private analyzer = new ChangeAnalyzer();

  async generate(files: string[], _diff?: string, branch?: string): Promise<string> {
    const porcelain = files.map((f) => ` M ${f}`).join('\n');
    return this.analyzer.generateCommitMessageFromPorcelain(porcelain, branch);
  }
}
