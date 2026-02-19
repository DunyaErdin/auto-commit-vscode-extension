import { execFile } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger';
import * as vscode from 'vscode';
import type { DiffSummary } from '../types';

const execFileP = promisify(execFile);

type QueueItem = {
  fn: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

export class GitService {
  private cwd: string | undefined;
  private queue: QueueItem[] = [];
  private running = false;
  private defaultTimeoutMs = 30000; 

  constructor(cwd?: string) {
    this.cwd = cwd;
    try {
      const cfg = vscode.workspace.getConfiguration('autoCommit');
      const t = cfg.get<number>('gitCommandTimeoutMs');
      if (typeof t === 'number' && t > 0) {this.defaultTimeoutMs = t;}
    } catch {
      // Ignore
    }
  }

  setWorkspaceRoot(root: string | undefined): void {
    this.cwd = root;
  }

  getWorkspaceRoot(): string | undefined {
    return this.cwd;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.running) {return;}
    const item = this.queue.shift();
    if (!item) {return;}
    this.running = true;
    try {
      const res = await item.fn();
      item.resolve(res);
    } catch (e) {
      item.reject(e);
    } finally {
      this.running = false;
      setImmediate(() => this.processQueue());
    }
  }

  private runGitWithTimeout(args: string[], timeoutMs?: number): Promise<{ stdout: string; stderr: string }> {
    const options: { cwd: string } = { cwd: this.cwd ?? process.cwd() };
    const to = timeoutMs ?? this.defaultTimeoutMs;
    logger.debug(`runGit: git ${args.join(' ')}`, { cwd: options.cwd });

    return this.enqueue(async () => {
      const p = execFileP('git', args, options) as Promise<{ stdout: string; stderr: string }>;
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('Git command timed out')), to)
      );
      const result = await Promise.race([p, timeout]);
      logger.debug('runGit stdout:', result.stdout || '');
      if (result.stderr) {logger.warn('runGit stderr:', result.stderr);}
      return result;
    });
  }

  public async isRepo(): Promise<boolean> {
    try {
      const { stdout } = await this.runGitWithTimeout(['rev-parse', '--is-inside-work-tree']);
      return String(stdout || '').trim() === 'true';
    } catch {
      return false;
    }
  }

  public async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await this.runGitWithTimeout(['rev-parse', '--abbrev-ref', 'HEAD']);
      return String(stdout || '').trim();
    } catch {
      return 'HEAD';
    }
  }

  public async isDetachedHead(): Promise<boolean> {
    const branch = await this.getCurrentBranch();
    return !branch || branch === 'HEAD';
  }

  public async getLastCommitMessage(): Promise<string> {
    try {
      const { stdout } = await this.runGitWithTimeout(['log', '-1', '--pretty=%s']);
      return String(stdout || '').trim();
    } catch {
      return '';
    }
  }

  public async getLastCommitTime(): Promise<string> {
    try {
      const { stdout } = await this.runGitWithTimeout(['log', '-1', '--pretty=%ci']);
      return String(stdout || '').trim();
    } catch {
      return '';
    }
  }

  public async commit(message: string): Promise<void> {
    logger.info('Staging changes...');
    await this.runGitWithTimeout(['add', '.']);
    try {
      logger.info(`Committing: ${message}`);
      await this.runGitWithTimeout(['commit', '-m', message]);
      logger.info('Commit successful');
    } catch (err: unknown) {
      const e = err as { stderr?: string; stdout?: string };
      const out = (e?.stderr || e?.stdout || '') as string;
      if (typeof out === 'string' && /nothing to commit/i.test(out)) {
        logger.debug('Nothing to commit');
        return;
      }
      logger.error('Commit failed', err);
      throw err;
    }
  }

  public async push(remote = 'origin', branch?: string): Promise<void> {
    const args = ['push', remote];
    if (branch) {args.push(branch);}
    logger.info(`Pushing to ${remote}${branch ? `/${branch}` : ''}`);
    await this.runGitWithTimeout(args);
    logger.info('Push complete');
  }

  public async statusPorcelain(): Promise<string> {
    const { stdout } = await this.runGitWithTimeout(['status', '--porcelain']);
    logger.debug('status --porcelain output:', stdout || '');
    return stdout || '';
  }

  public async diffNumstat(): Promise<string> {
    const { stdout } = await this.runGitWithTimeout(['diff', '--numstat']);
    return stdout || '';
  }

  public async diffNumstatCached(): Promise<string> {
    const { stdout } = await this.runGitWithTimeout(['diff', '--cached', '--numstat']);
    return stdout || '';
  }

  public parseNumstatToSummary(numstat: string): DiffSummary {
    let additions = 0;
    let deletions = 0;
    let files = 0;
    const lines = numstat.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\t/);
      if (parts.length >= 2) {
        const add = parseInt(parts[0], 10);
        const del = parseInt(parts[1], 10);
        if (!isNaN(add)) {additions += add;}
        if (!isNaN(del)) {deletions += del;}
        files++;
      }
    }
    return { additions, deletions, files };
  }
}
