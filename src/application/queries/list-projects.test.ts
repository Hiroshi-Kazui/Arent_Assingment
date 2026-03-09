import { describe, it, expect, vi, beforeEach } from 'vitest';

// listProjects は prisma を直接参照するため、vi.mock でモックする
vi.mock('../../infrastructure/prisma/prisma-client', () => ({
  default: {
    project: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '../../infrastructure/prisma/prisma-client';
import { listProjects } from './list-projects';

type MockIssue = { status: string };
type MockProject = {
  project_id: string;
  name: string;
  plan: string;
  building_id: string;
  branch_id: string | null;
  status: string;
  start_date: Date;
  due_date: Date;
  created_at: Date;
  _count: { issues: number };
  issues: MockIssue[];
};

function createMockProject(issues: MockIssue[]): MockProject {
  return {
    project_id: 'project-001',
    name: 'テストプロジェクト',
    plan: '',
    building_id: 'building-001',
    branch_id: 'branch-001',
    status: 'ACTIVE',
    start_date: new Date('2026-01-01'),
    due_date: new Date('2026-12-31'),
    created_at: new Date('2026-01-01'),
    _count: { issues: issues.length },
    issues,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listProjects - 統合テスト', () => {
  describe('進捗率算出 (APP-PRG-*)', () => {
    // APP-PRG-001: 進捗率算出 - Done=50%, Confirmed=100%, 他=0% の平均
    it('Done=50, Confirmed=100, Open=0 の平均が 50 になる', async () => {
      // Arrange
      const issues: MockIssue[] = [
        { status: 'DONE' },
        { status: 'CONFIRMED' },
        { status: 'OPEN' },
      ];
      const mockProject = createMockProject(issues);
      (prisma.project.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockProject]);
      (prisma.project.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      // Act
      const result = await listProjects({ page: 1, limit: 10 });

      // Assert
      // (50 + 100 + 0) / 3 = 50
      expect(result.items[0].progressRate).toBe(50);
    });

    // APP-PRG-002: 指摘 0 件のプロジェクトの進捗率は 0%
    it('issues が空配列のプロジェクトの progressRate が 0 になる', async () => {
      // Arrange
      const mockProject = createMockProject([]);
      (prisma.project.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockProject]);
      (prisma.project.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      // Act
      const result = await listProjects({ page: 1, limit: 10 });

      // Assert
      expect(result.items[0].progressRate).toBe(0);
    });

    // APP-PRG-003: Worker ロールでは自身担当の Issue のみで進捗率を算出する
    it('Worker ロールで listProjects を呼ぶと assignee_id フィルタが適用される', async () => {
      // Arrange
      const mockProject = createMockProject([{ status: 'IN_PROGRESS' }]);
      const findManyMock = vi.fn().mockResolvedValue([mockProject]);
      (prisma.project.findMany as ReturnType<typeof vi.fn>).mockImplementation(findManyMock);
      (prisma.project.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      // Act
      await listProjects({ page: 1, limit: 10 }, 'WORKER', undefined, 'worker-id');

      // Assert: findMany の呼び出し引数に assignee_id フィルタが含まれる
      const findManyArgs = findManyMock.mock.calls[0][0];
      expect(findManyArgs.where).toMatchObject({
        issues: {
          some: {
            assignee_id: 'worker-id',
          },
        },
      });
    });

    // APP-PRG-004: Supervisor ロールでは自支部の Project のみ取得される
    it('Supervisor ロールで listProjects を呼ぶと branch_id フィルタが適用される', async () => {
      // Arrange
      const mockProject = createMockProject([]);
      const findManyMock = vi.fn().mockResolvedValue([mockProject]);
      (prisma.project.findMany as ReturnType<typeof vi.fn>).mockImplementation(findManyMock);
      (prisma.project.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      // Act
      await listProjects({ page: 1, limit: 10 }, 'SUPERVISOR', 'branch-id');

      // Assert: findMany の呼び出し引数に branch_id フィルタが含まれる
      const findManyArgs = findManyMock.mock.calls[0][0];
      expect(findManyArgs.where).toMatchObject({
        branch_id: 'branch-id',
      });
    });

    // APP-PRG-005: 進捗率は Query 時に算出され DB には保存されない
    it('listProjects() は progressRate を DB に保存しない (prisma.project.update が呼ばれない)', async () => {
      // Arrange
      const mockProject = createMockProject([{ status: 'DONE' }]);
      (prisma.project.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockProject]);
      (prisma.project.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      const updateSpy = vi.fn();
      (prisma as any).project.update = updateSpy;

      // Act
      const result = await listProjects({ page: 1, limit: 10 });

      // Assert: progressRate は計算され返却されるが、update は呼ばれない
      expect(result.items[0].progressRate).toBe(50);
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('アーキテクチャ原則 (APP-ARC-001)', () => {
    // APP-ARC-001: Query ハンドラ (listProjects) は Domain 集約を経由せず直接 DB から読み取る
    it('listProjects のソースコードに Issue.reconstruct 等のドメイン集約ファクトリ呼び出しが存在しない', async () => {
      // Arrange: ソースコードを静的確認
      // Fixed: Windows環境で new URL().pathname が /C:/... を返し、readFileSync が C:\C:\... と解釈するため fileURLToPath を使用
      const { fileURLToPath } = await import('url');
      const sourceContent = await import('fs').then(fs =>
        fs.readFileSync(
          fileURLToPath(new URL('./list-projects.ts', import.meta.url)),
          'utf-8'
        )
      );

      // Assert: Domain 集約ファクトリメソッドが呼ばれていない（CQRS Query は集約を経由しない）
      expect(sourceContent).not.toContain('Issue.reconstruct');
      expect(sourceContent).not.toContain('Issue.create');
    });
  });
});
