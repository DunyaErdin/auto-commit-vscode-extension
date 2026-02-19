"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileP = (0, util_1.promisify)(child_process_1.execFile);
class GitService {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    async runGit(args) {
        const options = { cwd: this.cwd ?? process.cwd() };
        const result = await execFileP('git', args, options);
        return result;
    }
    async commit(message) {
        // Stage all changes then commit with a safely passed message
        await this.runGit(['add', '.']);
        try {
            await this.runGit(['commit', '-m', message]);
        }
        catch (err) {
            // If there's nothing to commit, ignore the error
            const out = (err && (err.stderr || err.stdout)) || '';
            if (typeof out === 'string' && /nothing to commit/i.test(out)) {
                return;
            }
            throw err;
        }
    }
    async push(remote = 'origin', branch) {
        const args = ['push', remote];
        if (branch) {
            args.push(branch);
        }
        await this.runGit(args);
    }
    async statusPorcelain() {
        const { stdout } = await this.runGit(['status', '--porcelain']);
        return stdout || '';
    }
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map