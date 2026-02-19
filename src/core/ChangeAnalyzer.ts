import logger from '../utils/logger';
import type { PorcelainEntry } from '../types';

const CONFIG_PATTERNS = [
  /\.(json|yaml|yml|toml|ini|config|cfg|properties)$/i,
  /(config|settings|\.env)/i,
];
const TEST_PATTERNS = [
  /\.(test|spec)\.(ts|js|java|kt|py)$/i,
  /test\//i,
  /__tests__/i,
  /tests?\//i,
];
const JAVA_PATTERNS = [/\.java$/i, /\.kt$/i, /\.kts$/i, /\.gradle$/i];
const TYPESCRIPT_PATTERNS = [/\.ts$/i, /\.tsx$/i, /\.js$/i, /\.jsx$/i];

export class ChangeAnalyzer {

  public parsePorcelain(porcelain: string): PorcelainEntry[] {
    if (!porcelain) {
      logger.debug('parsePorcelain: empty');
      return [];
    }
    const entries: PorcelainEntry[] = [];
    const lines = porcelain.split(/\r?\n/).filter((l) => l.trim());

    for (const line of lines) {
      const xy = line.substring(0, 2);
      const rest = line.substring(2).trim();
      if (!rest) {continue;}

      if (xy.startsWith('R') || xy.startsWith('C')) {
        const match = rest.match(/^(.+?)\s+->\s+(.+)$/);
        if (match) {
          entries.push({
            xy,
            path: match[1].trim(),
            renameTo: match[2].trim(),
          });
        } else {
          entries.push({ xy, path: rest });
        }
        continue;
      }

      if (xy.includes('U') || xy.includes('D') || xy.includes('A')) {
        const path = rest.split(/\s+/)[0];
        entries.push({ xy, path: path || rest });
        continue;
      }

      const path = rest.split(/\s+/).filter(Boolean)[0] || rest;
      entries.push({ xy, path });
    }

    logger.debug('parsePorcelain -> entries:', entries.length);
    return entries;
  }

  public analyzePorcelain(porcelain: string): string[] {
    const entries = this.parsePorcelain(porcelain);
    return entries.map((e) => e.renameTo ? `${e.path} -> ${e.renameTo}` : e.path);
  }

  public groupByFileType(files: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {
      java: [],
      ts: [],
      json: [],
      config: [],
      test: [],
      other: [],
    };

    for (const f of files) {
      const path = f.split(/\s+->\s+/)[0];
      if (TEST_PATTERNS.some((p) => p.test(path))) {
        groups.test.push(path);
      } else if (JAVA_PATTERNS.some((p) => p.test(path))) {
        groups.java.push(path);
      } else if (TYPESCRIPT_PATTERNS.some((p) => p.test(path))) {
        groups.ts.push(path);
      } else if (CONFIG_PATTERNS.some((p) => p.test(path))) {
        groups.config.push(path);
      } else if (/\.json$/i.test(path)) {
        groups.json.push(path);
      } else {
        groups.other.push(path);
      }
    }

    return groups;
  }

  private inferCommitType(groups: Record<string, string[]>): string {
    if (groups.test.length > 0 && groups.java.length === 0 && groups.ts.length === 0) {
      return 'test';
    }
    if (groups.config.length > 0 && groups.java.length === 0 && groups.ts.length === 0 && groups.other.length === 0) {
      return 'chore';
    }
    if (groups.java.length > 0 || groups.ts.length > 0) {
      return 'feat'; 
    }
    if (groups.config.length > 0) {return 'chore';}
    return 'feat';
  }

  private inferScope(files: string[], branch?: string): string {
    if (branch && /^feature\/(.+)$/i.test(branch)) {
      const m = branch.match(/^feature\/(.+)$/i);
      return m ? m[1].replace(/[/\\]/g, '-') : 'robot';
    }
    const first = files[0];
    if (!first) {return 'robot';}
    const path = first.split(/\s+->\s+/)[0];
    const parts = path.replace(/\\/g, '/').split('/');
    if (parts.length >= 2) {return parts[parts.length - 2];}
    return 'robot';
  }

  public generateCommitMessageFromPorcelain(porcelain: string, branch?: string): string {
    const entries = this.parsePorcelain(porcelain);
    const files = entries.map((e) => e.renameTo ? `${e.path} -> ${e.renameTo}` : e.path);
    if (files.length === 0) {return 'chore: no changes';}

    const groups = this.groupByFileType(files);
    const type = this.inferCommitType(groups);
    const scope = this.inferScope(files, branch);

    const primaryFiles = [...groups.java, ...groups.ts, ...groups.other].filter(Boolean);
    const mainName = primaryFiles[0]
      ? primaryFiles[0].replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '')
      : 'files';

    if (files.length === 1) {
      const action = entries[0].xy.startsWith('D') ? 'remove' : entries[0].xy.startsWith('R') ? 'rename' : 'update';
      return `${type}(${scope}): ${action} ${mainName}`;
    }

    const related = files.length - 1;
    return `${type}(${scope}): update ${mainName} and ${related} related file${related > 1 ? 's' : ''}`;
  }

  public generateCommitMessage(files: string[]): string {
    if (!files || files.length === 0) {return 'chore: no changes detected';}
    const porcelain = files.map((f) => ` M ${f}`).join('\n');
    return this.generateCommitMessageFromPorcelain(porcelain);
  }
}
