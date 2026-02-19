import * as vscode from 'vscode';
import { SessionManager } from './core/SessionManager';
import { WorkspaceResolver } from './core/WorkspaceResolver';
import { GitService } from './core/GitService';

let sessionManager: SessionManager | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const root = WorkspaceResolver.getActiveWorkspaceRoot();
  const git = new GitService(root);
  const isRepo = await git.isRepo();

  sessionManager = new SessionManager(context);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'auto-commit-vscode-extension.showMenu';

  const cfg = vscode.workspace.getConfiguration('autoCommit');
  const enabled = cfg.get<boolean>('enabled', true);

  const updateStatusBar = async (overrides?: {
    text?: string;
    tooltip?: string;
    error?: boolean;
    notGitRepo?: boolean;
  }) => {
    if (!statusBarItem) {return;}
    if (overrides?.notGitRepo) {
      statusBarItem.text = '$(git-branch) AutoCommit: Not a Git repo';
      statusBarItem.tooltip = 'Current folder is not a Git repository';
      statusBarItem.backgroundColor = undefined;
      return;
    }
    if (overrides?.error) {
      statusBarItem.text = `$(error) AutoCommit: ${enabled ? 'ON' : 'OFF'}`;
      statusBarItem.tooltip = 'Last operation failed';
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
      return;
    }
    if (overrides?.text) {statusBarItem.text = overrides.text;}
    if (overrides?.tooltip) {statusBarItem.tooltip = overrides.tooltip;}
    statusBarItem.backgroundColor = undefined;
    statusBarItem.show();
  };

  if (!isRepo && root) {
    await updateStatusBar({ notGitRepo: true });
  } else {
    statusBarItem.text = `$(git-commit) AutoCommit: ${enabled ? 'ON' : 'OFF'}`;
    statusBarItem.tooltip = 'AutoCommit: click for actions';
    statusBarItem.show();
  }

  let lastMessage = '';
  let lastCommitTime = '';

  const getGitForTooltip = (): GitService => {
    const root = WorkspaceResolver.getActiveWorkspaceRoot();
    return new GitService(root);
  };

  sessionManager.onDidCommit(async (payload: string) => {
    if (!statusBarItem) {return;}

    if (payload === 'notGitRepo') {
      await updateStatusBar({ notGitRepo: true });
      return;
    }
    if (payload === 'error') {
      await updateStatusBar({ error: true });
      return;
    }
    if (payload === 'progress:start') {
      statusBarItem.text = '$(sync~spin) AutoCommit: ON (committing...)';
      statusBarItem.tooltip = 'Committing...';
      statusBarItem.show();
      return;
    }
    if (payload === 'progress:end') {
      const g = getGitForTooltip();
      const branch = await g.getCurrentBranch();
      const msg = lastMessage ? `Last: ${lastMessage}` : '';
      const time = lastCommitTime ? ` | ${lastCommitTime}` : '';
      statusBarItem.text = `$(git-commit) AutoCommit: ON`;
      statusBarItem.tooltip = `Branch: ${branch}${msg ? `\n${msg}` : ''}${time}`;
      statusBarItem.backgroundColor = undefined;
      statusBarItem.show();
      return;
    }
    if (payload.startsWith('commit:')) {
      lastMessage = payload.slice('commit:'.length);
      lastCommitTime = new Date().toLocaleTimeString();
      const g = getGitForTooltip();
      const branch = await g.getCurrentBranch();
      statusBarItem.text = `$(git-commit) AutoCommit: ON`;
      statusBarItem.tooltip = `Branch: ${branch}\nLast: ${lastMessage}\n${lastCommitTime}`;
      statusBarItem.show();
      return;
    }
    if (payload.startsWith('enabled:')) {
      const on = payload.split(':')[1] === 'true';
      statusBarItem.text = `$(git-commit) AutoCommit: ${on ? 'ON' : 'OFF'}`;
      statusBarItem.tooltip = 'AutoCommit: click for actions';
      statusBarItem.show();
    }
  });

  const showMenu = vscode.commands.registerCommand(
    'auto-commit-vscode-extension.showMenu',
    async () => {
      const choice = await vscode.window.showQuickPick(
        [
          {
            label: 'Commit Now',
            description: 'Create an automatic commit now',
          },
          {
            label: 'Push Now',
            description: 'Push commits to remote',
          },
          {
            label: 'Toggle AutoCommit',
            description: 'Enable/disable automatic commits',
          },
        ],
        { placeHolder: 'AutoCommit actions' }
      );
      if (!choice) {return;}
      if (choice.label === 'Commit Now') {
        try {
          statusBarItem!.text = '$(sync~spin) AutoCommit: ON (committing...)';
          await sessionManager?.commitNow(true);
        } catch (err) {
          vscode.window.showErrorMessage(
            `AutoCommit: ${(err as Error)?.message || err}`
          );
        }
      } else if (choice.label === 'Push Now') {
        await sessionManager?.pushNow();
      } else if (choice.label === 'Toggle AutoCommit') {
        const cfg = vscode.workspace.getConfiguration('autoCommit');
        const en = cfg.get<boolean>('enabled', true);
        await cfg.update('enabled', !en, vscode.ConfigurationTarget.Global);
        sessionManager?.setEnabled(!en);
      }
    }
  );
  context.subscriptions.push(showMenu);

  const toggle = vscode.commands.registerCommand(
    'auto-commit-vscode-extension.toggle',
    async () => {
      const cfg = vscode.workspace.getConfiguration('autoCommit');
      const en = cfg.get<boolean>('enabled', true);
      await cfg.update('enabled', !en, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `AutoCommit ${!en ? 'enabled' : 'disabled'}`
      );
      sessionManager?.setEnabled(!en);
    }
  );

  const commitNow = vscode.commands.registerCommand(
    'auto-commit-vscode-extension.commitNow',
    async () => {
      try {
        await sessionManager?.commitNow(true);
        vscode.window.showInformationMessage('AutoCommit: commit complete');
      } catch (err) {
        vscode.window.showErrorMessage(
          `AutoCommit error: ${(err as Error)?.message || err}`
        );
      }
    }
  );

  const pushNow = vscode.commands.registerCommand(
    'auto-commit-vscode-extension.pushNow',
    async () => {
      await sessionManager?.pushNow();
    }
  );

  context.subscriptions.push(
    toggle,
    commitNow,
    pushNow,
    {
      dispose: () => sessionManager?.dispose(),
    }
  );
}

export function deactivate(): void {
  sessionManager?.dispose();
}
