// Manual mock for vscode module
module.exports = {
  window: {
    createOutputChannel: () => ({
      appendLine: jest.fn(),
      show: jest.fn(),
    }),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    activeTextEditor: null,
  },
  workspace: {
    getConfiguration: () => ({
      get: jest.fn(() => 'info'),
    }),
    workspaceFolders: [],
    getWorkspaceFolder: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
    onDidChangeTextDocument: jest.fn(),
  },
  EventEmitter: jest.fn().mockImplementation(function () {
    return { fire: jest.fn(), event: jest.fn() };
  }),
  StatusBarAlignment: { Left: 0, Right: 1 },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  ThemeColor: jest.fn(),
};
