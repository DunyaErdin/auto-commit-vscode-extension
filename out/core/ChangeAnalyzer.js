"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeAnalyzer = void 0;
class ChangeAnalyzer {
    analyzePorcelain(porcelain) {
        if (!porcelain) {
            return [];
        }
        const lines = porcelain.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const files = lines.map(l => {
            const parts = l.split(/\s+/);
            return parts.slice(1).join(' ');
        }).filter(Boolean);
        return files;
    }
    generateCommitMessage(files = []) {
        if (!files || files.length === 0) {
            return 'Auto commit: no changes detected';
        }
        if (files.length === 1) {
            return `Auto commit: ${files[0]}`;
        }
        const count = files.length;
        if (count <= 3) {
            return `Auto commit: ${files.join(', ')}`;
        }
        const preview = files.slice(0, 3).map(f => f.replace(/^\.\/|^\\/, '')).join(', ');
        return `Auto commit: ${preview} and ${count - 3} more files`;
    }
    generateCommitMessageFromPorcelain(porcelain) {
        const files = this.analyzePorcelain(porcelain);
        return this.generateCommitMessage(files);
    }
}
exports.ChangeAnalyzer = ChangeAnalyzer;
//# sourceMappingURL=ChangeAnalyzer.js.map