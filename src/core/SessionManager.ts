import * as vscode from 'vscode';
import { GitService } from './GitService';
import { ChangeAnalyzer } from './ChangeAnalyzer';
import { WorkspaceResolver } from './WorkspaceResolver';
import { DebounceEngine } from './DebounceEngine';
import { showCommitPreview } from '../ui/CommitPreviewPanel';
import { MetricsService } from '../utils/MetricsService';
import logger from '../utils/logger';
import type { CommitMode } from '../types';

export class SessionManager {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly git: GitService;
  private readonly analyzer: ChangeAnalyzer;
  private readonly debounceEngine: DebounceEngine;
  private readonly metrics: MetricsService;
  private enabled = true;
  private statusEmitter = new vscode.EventEmitter<string>();
  public readonly onDidCommit = this.statusEmitter.event;
  private commitMutex = false;

  constructor(private context: vscode.ExtensionContext) {
    const root = WorkspaceResolver.getActiveWorkspaceRoot();
    this.git = new GitService(root);
    this.analyzer = new ChangeAnalyzer();
    this.debounceEngine = new DebounceEngine();
    this.metrics = new MetricsService(context);
    logger.info('SessionManager initialized', { root });
    this.setupListeners();
    this.loadConfigAndMaybeSchedule();
    this.setupWorkspaceWatcher();
  }

  private setupWorkspaceWatcher(): void {
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        const newRoot = WorkspaceResolver.getActiveWorkspaceRoot();
        const current = this.git.getWorkspaceRoot();
        if (newRoot && newRoot !== current) {
          this.git.setWorkspaceRoot(newRoot);
          logger.debug('Workspace root updated', { newRoot });
        }
      })
    );
  }

  private loadConfigAndMaybeSchedule(): void {
    const cfg = vscode.workspace.getConfiguration('autoCommit');
    const mode = cfg.get<CommitMode>('mode', 'safe');
    const interval = cfg.get<number>('intervalMs', 5 * 60 * 1000);

    if (mode === 'auto') {
      this.startInterval(interval);
    }
  }

  private setupListeners(): void {
    this.context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        this.debounceEngine.recordSave();
        this.registerChange();
      }),
      vscode.workspace.onDidChangeTextDocument(() => {
        this.debounceEngine.recordChange();
        this.registerChange();
      })
    );
    logger.debug('SessionManager listeners registered');
  }

  public setEnabled(v: boolean): void {
    this.enabled = v;
    this.statusEmitter.fire(`enabled:${v}`);
    logger.info(`AutoCommit enabled: ${v}`);
  }

  private startInterval(ms: number): void {
    if (this.intervalHandle) {clearInterval(this.intervalHandle);}
    this.intervalHandle = setInterval(() => this.commitNow(false), ms);
  }

  public registerChange(): void {
    if (!this.enabled) {return;}

    const cfg = vscode.workspace.getConfiguration('autoCommit');
    const mode = cfg.get<CommitMode>('mode', 'safe');

    if (mode === 'manual') {return;}

    const debounce = cfg.get<number>('debounceMs', 2000);
    if (this.timeout) {clearTimeout(this.timeout);}

    this.timeout = setTimeout(
      () =>
        this.commitNow(false).catch((err) => {
          logger.error('AutoCommit commit failed', err);
          vscode.window.showErrorMessage(
            `AutoCommit: ${(err as Error)?.message || err}`
          );
        }),
      debounce
    );
  }

  public async commitNow(manual = true): Promise<void> {

    const root = WorkspaceResolver.getActiveWorkspaceRoot();
    if (!root) {
      this.statusEmitter.fire('noWorkspace');
      return;
    }
    this.git.setWorkspaceRoot(root);

    const cfg = vscode.workspace.getConfiguration('autoCommit');
    const mode = cfg.get<CommitMode>('mode', 'safe');

    if (this.commitMutex) {
      logger.debug('commitNow: skipped (mutex)');
      return;
    }
    this.commitMutex = true;

    try {
      this.statusEmitter.fire('progress:start');

      const isRepo = await this.git.isRepo();
      if (!isRepo) {
        this.statusEmitter.fire('notGitRepo');
        this.statusEmitter.fire('progress:end');
        return;
      }

      const porcelain = await this.git.statusPorcelain();
      if (!porcelain || !porcelain.trim()) {
        this.statusEmitter.fire('progress:end');
        return;
      }

      const skip = this.debounceEngine.shouldSkipCommit(porcelain);
      if (skip.skip && !manual) {
        logger.debug('commitNow: skipped', skip.reason);
        this.statusEmitter.fire('progress:end');
        return;
      }

      const branch = await this.git.getCurrentBranch();
      const detached = await this.git.isDetachedHead();

      if (detached) {
        vscode.window.showWarningMessage(
          'AutoCommit: Detached HEAD state. Commit may create orphan commit.'
        );
      }

      const protectMain = cfg.get<boolean>('protectMainBranch', true);
      if (
        protectMain &&
        mode === 'safe' &&
        (branch === 'main' || branch === 'master')
      ) {
        const proceed = await vscode.window.showWarningMessage(
          `You are on ${branch}. AutoCommit usually avoids main/master. Proceed?`,
          'Yes',
          'No'
        );
        if (proceed !== 'Yes') {
          this.statusEmitter.fire('progress:end');
          return;
        }
      }

      const entries = this.analyzer.parsePorcelain(porcelain);
      const message = this.analyzer.generateCommitMessageFromPorcelain(
        porcelain,
        branch
      );
      const diffNumstat = await this.git.diffNumstat();
      const diffSummary = this.git.parseNumstatToSummary(
        diffNumstat + '\n' + (await this.git.diffNumstatCached())
      );

      if (mode === 'safe') {
        const preview = await showCommitPreview({
          changedFiles: entries,
          diffSummary,
          generatedMessage: message,
          branch,
        });
        if (preview.action === 'cancel') {
          this.statusEmitter.fire('progress:end');
          return;
        }
        if (preview.action === 'approve' && preview.message) {
          await this.doCommit(preview.message);
        }
      } else if (mode === 'auto') {
        await this.doCommit(message);
      } else {
        await this.doCommit(message);
      }

      await this.metrics.recordCommit(!manual);
    } catch (err) {
      this.statusEmitter.fire('error');
      throw err;
    } finally {
      this.commitMutex = false;
      this.statusEmitter.fire('progress:end');
    }
  }

  private async doCommit(message: string): Promise<void> {
    await this.git.commit(message);
    this.statusEmitter.fire(`commit:${message}`);
    logger.info('commitNow: commit finished');
  }

  public async pushNow(): Promise<void> {
    const root = WorkspaceResolver.getActiveWorkspaceRoot();
    if (!root) {return;}
    this.git.setWorkspaceRoot(root);
    const isRepo = await this.git.isRepo();
    if (!isRepo) {
      vscode.window.showErrorMessage('Not a Git repository.');
      return;
    }
    try {
      await this.git.push();
    } catch (err) {
      logger.error('pushNow failed', err);
      throw err;
    }
  }

  public dispose(): void {
    if (this.timeout) {clearTimeout(this.timeout);}
    if (this.intervalHandle) {clearInterval(this.intervalHandle);}
    logger.debug('SessionManager disposed');
  }
}
