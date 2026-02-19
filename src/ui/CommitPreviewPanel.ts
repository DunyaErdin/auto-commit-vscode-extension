import * as vscode from 'vscode';
import type { CommitPreviewData } from '../types';

export type PreviewAction = 'approve' | 'edit' | 'cancel';

export interface PreviewResult {
  action: PreviewAction;
  message?: string;
}

export async function showCommitPreview(data: CommitPreviewData): Promise<PreviewResult> {
  const { changedFiles, diffSummary, generatedMessage, branch } = data;

  const fileList = changedFiles
    .slice(0, 15)
    .map((e) => (e.renameTo ? `${e.path} → ${e.renameTo}` : e.path));
  const moreCount = Math.max(0, changedFiles.length - 15);
  const fileSummary =
    moreCount > 0 ? `${fileList.join(', ')}, ... +${moreCount} more` : fileList.join(', ');

  const diffLine = `+${diffSummary.additions} -${diffSummary.deletions} lines`;
  const previewDetail = `Branch: ${branch} | ${diffLine}\nFiles: ${fileSummary}\n\nMessage: ${generatedMessage}`;

  const choices: vscode.QuickPickItem[] = [
    {
      label: '$(check) Approve',
      description: 'Commit with generated message',
      detail: previewDetail,
    },
    {
      label: '$(edit) Edit Message',
      description: 'Modify commit message',
      detail: previewDetail,
    },
    {
      label: '$(close) Cancel',
      description: 'Cancel commit',
      detail: previewDetail,
    },
  ];

  const pick = await vscode.window.showQuickPick(choices, {
    placeHolder: generatedMessage,
    title: `AutoCommit Preview | ${changedFiles.length} files | ${diffLine}`,
    ignoreFocusOut: true,
  });

  if (!pick) {return { action: 'cancel' };}

  if (pick.label.includes('Approve')) {
    return { action: 'approve', message: generatedMessage };
  }
  if (pick.label.includes('Edit')) {
    const edited = await vscode.window.showInputBox({
      value: generatedMessage,
      prompt: 'Edit commit message',
      title: 'AutoCommit: Edit Message',
      validateInput: (v) => (v?.trim() ? null : 'Message cannot be empty'),
    });
    if (edited?.trim()) {return { action: 'approve', message: edited.trim() };}
    return { action: 'cancel' };
  }
  return { action: 'cancel' };
}
