import { ChangeAnalyzer } from '../ChangeAnalyzer';

describe('ChangeAnalyzer', () => {
  let analyzer: ChangeAnalyzer;

  beforeEach(() => {
    analyzer = new ChangeAnalyzer();
  });

  describe('parsePorcelain', () => {
    it('parses modified files', () => {
      const porcelain = ' M src/foo.ts\n M src/bar.ts';
      const entries = analyzer.parsePorcelain(porcelain);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({ xy: ' M', path: 'src/foo.ts' });
      expect(entries[1]).toEqual({ xy: ' M', path: 'src/bar.ts' });
    });

    it('parses added files', () => {
      const porcelain = 'A  newfile.ts';
      const entries = analyzer.parsePorcelain(porcelain);
      expect(entries).toHaveLength(1);
      expect(entries[0].xy).toContain('A');
      expect(entries[0].path).toBe('newfile.ts');
    });

    it('parses deleted files', () => {
      const porcelain = 'D  deleted.ts';
      const entries = analyzer.parsePorcelain(porcelain);
      expect(entries).toHaveLength(1);
      expect(entries[0].xy).toContain('D');
      expect(entries[0].path).toBe('deleted.ts');
    });

    it('parses rename (R status)', () => {
      const porcelain = 'R  old.ts -> new.ts';
      const entries = analyzer.parsePorcelain(porcelain);
      expect(entries).toHaveLength(1);
      expect(entries[0].path).toBe('old.ts');
      expect(entries[0].renameTo).toBe('new.ts');
    });

    it('returns empty for empty input', () => {
      expect(analyzer.parsePorcelain('')).toEqual([]);
      expect(analyzer.parsePorcelain('   \n\n')).toEqual([]);
    });
  });

  describe('generateCommitMessageFromPorcelain', () => {
    it('generates chore for config-only changes', () => {
      const porcelain = ' M config.json\n M settings.yaml';
      const msg = analyzer.generateCommitMessageFromPorcelain(porcelain);
      expect(msg).toMatch(/^chore/);
    });

    it('generates feat for Java/TS files', () => {
      const porcelain = ' M MotorController.java';
      const msg = analyzer.generateCommitMessageFromPorcelain(porcelain);
      expect(msg).toMatch(/^feat/);
    });

    it('includes scope from branch when feature/*', () => {
      const porcelain = ' M robot/DriveController.java';
      const msg = analyzer.generateCommitMessageFromPorcelain(
        porcelain,
        'feature/drive-control'
      );
      expect(msg).toMatch(/drive-control/);
    });

    it('generates conventional format for single file', () => {
      const porcelain = ' M MotorController.java';
      const msg = analyzer.generateCommitMessageFromPorcelain(porcelain);
      expect(msg).toMatch(/\(robot\)|\([\w-]+\)/);
    });
  });

  describe('analyzePorcelain (legacy)', () => {
    it('returns file paths', () => {
      const porcelain = ' M a.ts\n M b.ts';
      const files = analyzer.analyzePorcelain(porcelain);
      expect(files).toEqual(['a.ts', 'b.ts']);
    });
  });
});
