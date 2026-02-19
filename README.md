# AutoCommit

**AI-aware Git assistant • Robot code safe guard • Team workflow stabilizer**

Smart auto-commit VS Code extension with safe/auto/manual modes, branch awareness, conventional commits, and multi-root workspace support.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.109+-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### 🔒 Git Safety & Workspace Stability
- **Multi-root workspace**: Uses the folder of your active editor
- **Not a Git repo**: Status bar shows "Not a Git repo", no commit attempts
- **Detached HEAD**: Warning before commit
- **Branch protection**: Warns when committing to main/master (safe mode)

### 📋 Commit Flow Modes
| Mode | Behavior |
|------|----------|
| **safe** (default) | Preview QuickPick before commit – files, diff summary, message |
| **auto** | Commit automatically after debounce (optional push) |
| **manual** | Only commits via "Commit Now" command |

### 📝 Commit Preview UI
- Changed files list
- Diff summary (+additions -deletions)
- Generated conventional commit message
- Branch name
- **Approve** | **Edit Message** | **Cancel**

### 🧠 Smart Change Analysis
- Rename detection (`R` status)
- Deleted file detection
- File type grouping: `.java`, `.ts`, `.json`, config
- Conventional commit format: `feat(robot): update MotorController and 2 related files`
- Heuristics: config → chore, test files → test, Java/TS → feat

### 🌿 Branch Awareness
- `feature/*` → scope auto-prefixed: `feat(feature/drive-control): ...`
- Main/master warning in safe mode

### ⚡ Intelligent Debounce
- Save spam detection
- Rapid edit threshold
- Minimum file count threshold (configurable)

### 🎯 Status Bar
- Spinner during commit
- Tooltip: Branch, last commit message, last commit time
- Error state: red icon

## Requirements
- VS Code 1.109+
- Git

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `autoCommit.enabled` | `true` | Enable/disable extension |
| `autoCommit.mode` | `safe` | `safe` \| `auto` \| `manual` |
| `autoCommit.debounceMs` | `2000` | Debounce delay (ms) |
| `autoCommit.intervalMs` | `300000` | Interval mode (5 min) |
| `autoCommit.pushAfterCommit` | `false` | Push after commit |
| `autoCommit.minChanges` | `0` | Min files to trigger commit |
| `autoCommit.protectMainBranch` | `true` | Warn on main/master |
| `autoCommit.logLevel` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `autoCommit.gitCommandTimeoutMs` | `30000` | Git command timeout |

## Commands

- **AutoCommit: Show Menu** – Commit Now, Push Now, Toggle
- **AutoCommit: Commit Now** – Manual commit
- **AutoCommit: Push Now** – Push to remote
- **Toggle AutoCommit** – Enable/disable

## Development

```bash
cd auto-commit-vscode-extension
yarn install
yarn compile
yarn test          # VS Code integration tests
yarn test:unit     # Jest unit tests
```

## License
MIT
