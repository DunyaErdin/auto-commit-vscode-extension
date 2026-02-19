"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
// Use global setTimeout/clearTimeout — importing 'timers' can cause
// type resolution issues in some TS configurations.
const vscode = __importStar(require("vscode"));
const GitService_1 = require("./GitService");
const ChangeAnalyzer_1 = require("./ChangeAnalyzer");
class SessionManager {
    context;
    timeout = null;
    intervalHandle = null;
    git;
    analyzer;
    enabled = true;
    constructor(context) {
        this.context = context;
        this.git = new GitService_1.GitService();
        this.analyzer = new ChangeAnalyzer_1.ChangeAnalyzer();
        this.setupListeners();
        this.loadConfigAndMaybeSchedule();
    }
    loadConfigAndMaybeSchedule() {
        const cfg = vscode.workspace.getConfiguration('autoCommit');
        const mode = cfg.get('mode', 'debounced');
        const interval = cfg.get('intervalMs', 5 * 60 * 1000);
        if (mode === 'interval') {
            this.startInterval(interval);
        }
    }
    setupListeners() {
        this.context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => this.registerChange()), vscode.workspace.onDidChangeTextDocument(() => this.registerChange()));
    }
    setEnabled(v) {
        this.enabled = v;
    }
    startInterval(ms) {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
        }
        this.intervalHandle = setInterval(() => this.commitNow(), ms);
    }
    registerChange() {
        if (!this.enabled) {
            return;
        }
        const cfg = vscode.workspace.getConfiguration('autoCommit');
        const debounce = cfg.get('debounceMs', 2000);
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => this.commitNow().catch(err => {
            vscode.window.showErrorMessage(`AutoCommit: commit failed: ${err?.message || err}`);
        }), debounce);
    }
    async commitNow() {
        try {
            const porcelain = await this.git.statusPorcelain();
            const message = this.analyzer.generateCommitMessageFromPorcelain(porcelain);
            if (!porcelain || !porcelain.trim()) {
                // nothing to commit
                return;
            }
            await this.git.commit(message);
            const cfg = vscode.workspace.getConfiguration('autoCommit');
            const pushAfter = cfg.get('pushAfterCommit', false);
            if (pushAfter) {
                try {
                    await this.git.push();
                }
                catch (err) {
                    vscode.window.showWarningMessage(`AutoCommit: push failed: ${err?.message || err}`);
                }
            }
        }
        catch (err) {
            throw err;
        }
    }
    async pushNow() {
        try {
            await this.git.push();
        }
        catch (err) {
            vscode.window.showErrorMessage(`AutoCommit: push failed: ${err?.message || err}`);
        }
    }
    dispose() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
        }
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=SessionManager.js.map