import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateIssueStatusHandler } from './update-issue-status';
import { AddPhotoHandler } from './add-photo';
import { IIssueRepository } from '../../domain/repositories/issue-repository';
import { IPhotoRepository } from '../../domain/repositories/photo-repository';
import { IStatusChangeLogRepository } from '../../domain/repositories/status-change-log-repository';
import { PhotoStorage } from '../../domain/repositories/photo-storage';
import {
  Issue,
  IssueId,
  IssueStatus,
  IssueType,
  IssuePriority,
} from '../../domain/models/issue';
import { Photo, PhotoId, PhotoPhase } from '../../domain/models/photo';
import { StatusChangeLog } from '../../domain/models/status-change-log';
import { ProjectId } from '../../domain/models/project';
import { FloorId } from '../../domain/models/floor';
import { UserId } from '../../domain/models/user';
import { Location } from '../../domain/models/location';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition-error';

// テストヘルパー
function createTestIssue(
  status: IssueStatus,
  assigneeId?: UserId
): Issue {
  return Issue.reconstruct(
    IssueId.create('issue-001'),
    ProjectId.create('project-001'),
    FloorId.create('floor-001'),
    'テストタイトル',
    'テスト説明',
    IssueType.Quality,
    UserId.create('reporter-001'),
    Location.createFromDbId('elem-001'),
    IssuePriority.Medium,
    status,
    new Date('2026-12-31'),
    new Date('2026-01-01'),
    new Date('2026-01-01'),
    assigneeId
  );
}

function createAfterPhoto(): Photo {
  return Photo.reconstruct(
    PhotoId.create('photo-001'),
    IssueId.create('issue-001'),
    'projects/p1/issues/i1/photos/photo-001.jpg',
    PhotoPhase.After,
    new Date(),
    'user-001'
  );
}

function createRejectionPhoto(): Photo {
  return Photo.reconstruct(
    PhotoId.create('photo-002'),
    IssueId.create('issue-001'),
    'projects/p1/issues/i1/photos/photo-002.jpg',
    PhotoPhase.Rejection,
    new Date(),
    'user-001'
  );
}

function createMockIssueRepository(issue: Issue | null = null): IIssueRepository {
  return {
    findById: vi.fn().mockResolvedValue(issue),
    save: vi.fn().mockResolvedValue(undefined),
    findByProjectId: vi.fn().mockResolvedValue([]),
    findByProjectIdAndFloorId: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockPhotoRepository(photos: Photo[] = []): IPhotoRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByIssueId: vi.fn().mockResolvedValue(photos),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockStatusChangeLogRepository(): IStatusChangeLogRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findByIssueId: vi.fn().mockResolvedValue([]),
  };
}

function createMockPhotoStorage(): PhotoStorage {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('UpdateIssueStatusHandler - 統合テスト', () => {
  describe('写真ルール (APP-PHT-*)', () => {
    // APP-PHT-001: InProgress → Done 時に After 写真が 0 枚だと Error がスローされる
    it('InProgress → Done 時に After 写真が 0 枚だと Error がスローされる', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.InProgress);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([]); // After 写真なし
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act & Assert
      await expect(
        handler.execute({
          issueId: 'issue-001',
          projectId: 'project-001',
          newStatus: 'DONE',
          changedBy: 'user-001',
        })
      ).rejects.toThrow('是正完了には是正後写真が1枚以上必要です');
    });

    // APP-PHT-002: InProgress → Done 時に After 写真が 1 枚以上あると遷移が成功する (境界値)
    it('InProgress → Done 時に After 写真が 1 枚以上あると遷移が成功する', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.InProgress);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([createAfterPhoto()]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act
      await handler.execute({
        issueId: 'issue-001',
        projectId: 'project-001',
        newStatus: 'DONE',
        changedBy: 'user-001',
      });

      // Assert
      expect(issueRepo.save).toHaveBeenCalled();
    });
  });

  describe('Assignee 権限 (APP-ASG-*)', () => {
    // APP-ASG-002: Worker が自分担当の Issue のステータスを変更できる
    it('Worker が自分担当の Issue のステータスを変更できる', async () => {
      // Arrange
      const assigneeId = UserId.create('worker-id');
      const issue = createTestIssue(IssueStatus.Open, assigneeId);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act
      await handler.execute({
        issueId: 'issue-001',
        projectId: 'project-001',
        newStatus: 'IN_PROGRESS',
        changedBy: 'worker-id',
      });

      // Assert
      expect(issueRepo.save).toHaveBeenCalled();
    });

    // APP-ASG-003: Worker が他者担当の Issue のステータスを変更しようとするとエラー
    it('Worker が他者担当の Issue のステータスを変更しようとすると Error がスローされる', async () => {
      // Arrange
      const assigneeId = UserId.create('assignee-id');
      const issue = createTestIssue(IssueStatus.Open, assigneeId);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act & Assert
      await expect(
        handler.execute({
          issueId: 'issue-001',
          projectId: 'project-001',
          newStatus: 'IN_PROGRESS',
          changedBy: 'other-worker-id',
        })
      ).rejects.toThrow('担当者以外はステータスを変更できません');
    });
  });

  describe('ステータス変更コメント・否認写真ルール (APP-ISS-*)', () => {
    // APP-ISS-001: Done → Open (否認) 時にコメントなしだと Error がスローされる
    it('Done → Open (否認) 時にコメントなしだと Error がスローされる', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Done);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([createAfterPhoto()]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act & Assert
      await expect(
        handler.execute({
          issueId: 'issue-001',
          projectId: 'project-001',
          newStatus: 'OPEN',
          changedBy: 'user-001',
          comment: '',
        })
      ).rejects.toThrow('否認・再指摘にはコメントが必須です');
    });

    // APP-ISS-002: Confirmed → Open (再指摘) 時にコメントなしだと Error がスローされる
    it('Confirmed → Open (再指摘) 時にコメント undefined だと Error がスローされる', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Confirmed);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([createRejectionPhoto()]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act & Assert
      await expect(
        handler.execute({
          issueId: 'issue-001',
          projectId: 'project-001',
          newStatus: 'OPEN',
          changedBy: 'user-001',
          comment: undefined,
        })
      ).rejects.toThrow('否認・再指摘にはコメントが必須です');
    });

    // APP-ISS-003: Confirmed → Open (再指摘) 時に Rejection 写真なしだと Error がスローされる
    it('Confirmed → Open (再指摘) 時に Rejection 写真なしだと Error がスローされる', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Confirmed);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([]); // Rejection 写真なし
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act & Assert
      await expect(
        handler.execute({
          issueId: 'issue-001',
          projectId: 'project-001',
          newStatus: 'OPEN',
          changedBy: 'user-001',
          comment: '再指摘理由',
        })
      ).rejects.toThrow('再指摘には否認時写真が1枚以上必要です');
    });

    // APP-ISS-004: Confirmed → Open (再指摘) 時に Rejection 写真が 1 枚以上あると遷移が成功する (境界値)
    it('Confirmed → Open (再指摘) 時に Rejection 写真が 1 枚以上あると遷移が成功する', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Confirmed);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([createRejectionPhoto()]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act
      await handler.execute({
        issueId: 'issue-001',
        projectId: 'project-001',
        newStatus: 'OPEN',
        changedBy: 'user-001',
        comment: '再指摘理由',
      });

      // Assert
      expect(issueRepo.save).toHaveBeenCalled();
    });

    // APP-ISS-005: 未サポートの状態遷移要求時に InvalidStatusTransitionError がスローされる
    it('Open → Confirmed は不正遷移として InvalidStatusTransitionError がスローされる', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Open);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act & Assert
      await expect(
        handler.execute({
          issueId: 'issue-001',
          projectId: 'project-001',
          newStatus: 'CONFIRMED',
          changedBy: 'user-001',
        })
      ).rejects.toThrow(InvalidStatusTransitionError);
    });
  });

  describe('StatusChangeLog 記録 (APP-DOM-001)', () => {
    // APP-DOM-001: UpdateIssueStatusHandler がステータス変更後に StatusChangeLog を保存する
    it('ステータス変更後に StatusChangeLog が保存され fromStatus/toStatus が正しい', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Open);
      const issueRepo = createMockIssueRepository(issue);
      const photoRepo = createMockPhotoRepository([]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act
      await handler.execute({
        issueId: 'issue-001',
        projectId: 'project-001',
        newStatus: 'IN_PROGRESS',
        changedBy: 'user-001',
      });

      // Assert
      expect(logRepo.save).toHaveBeenCalledOnce();
      const savedLog = (logRepo.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as StatusChangeLog;
      expect(savedLog.fromStatus).toBe(IssueStatus.Open);
      expect(savedLog.toStatus).toBe(IssueStatus.InProgress);
    });
  });

  describe('アーキテクチャ原則 (APP-ARC-002)', () => {
    // APP-ARC-002: UpdateIssueStatusHandler (Issue 系 Command) が Domain 集約を経由する
    it('Domain 集約メソッドを経由してから issueRepository.save() が呼ばれる', async () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Open);
      const saveSpy = vi.fn().mockResolvedValue(undefined);
      const issueRepo: IIssueRepository = {
        findById: vi.fn().mockResolvedValue(issue),
        save: saveSpy,
        findByProjectId: vi.fn().mockResolvedValue([]),
        findByProjectIdAndFloorId: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      const photoRepo = createMockPhotoRepository([]);
      const logRepo = createMockStatusChangeLogRepository();
      const handler = new UpdateIssueStatusHandler(issueRepo, photoRepo, logRepo);

      // Act
      await handler.execute({
        issueId: 'issue-001',
        projectId: 'project-001',
        newStatus: 'IN_PROGRESS',
        changedBy: 'user-001',
      });

      // Assert: save に渡された Issue が InProgress になっていること（集約メソッドが呼ばれた証拠）
      expect(saveSpy).toHaveBeenCalledOnce();
      const savedIssue = saveSpy.mock.calls[0][0] as Issue;
      expect(savedIssue.status).toBe(IssueStatus.InProgress);
    });
  });
});

describe('AddPhotoHandler - 統合テスト', () => {
  describe('写真アップロードルール (APP-PHT-003, APP-PHT-004)', () => {
    // APP-PHT-003: AddPhotoHandler が BlobKey を正規形式で生成する
    it('BlobKey が projects/{projectId}/issues/{issueId}/photos/{photoId}.{ext} 形式で生成される', async () => {
      // Arrange
      const issue = Issue.reconstruct(
        IssueId.create('i1'),
        ProjectId.create('p1'),
        FloorId.create('floor-001'),
        'タイトル',
        '説明',
        IssueType.Quality,
        UserId.create('reporter-001'),
        Location.createFromDbId('elem-001'),
        IssuePriority.Medium,
        IssueStatus.InProgress,
        new Date('2026-12-31'),
        new Date('2026-01-01'),
        new Date('2026-01-01'),
        undefined
      );
      const issueRepo = createMockIssueRepository(issue);
      const photoStorage = createMockPhotoStorage();
      const photoRepo = createMockPhotoRepository();
      const handler = new AddPhotoHandler(issueRepo, photoStorage, photoRepo);

      // Act
      await handler.execute({
        issueId: 'i1',
        projectId: 'p1',
        file: Buffer.from('fake-image-data'),
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        photoPhase: 'BEFORE',
        uploadedBy: 'u1',
      });

      // Assert: upload の第1引数 (key) が期待パターンに合致する
      const uploadCall = (photoStorage.upload as ReturnType<typeof vi.fn>).mock.calls[0];
      const uploadedKey: string = uploadCall[0];
      expect(uploadedKey).toMatch(/^projects\/p1\/issues\/i1\/photos\/.+\.jpg$/);
    });

    // APP-PHT-004: AddPhotoHandler が PhotoStorage.upload() を先に呼び、その後 IPhotoRepository.save() を呼ぶ
    it('PhotoStorage.upload() が IPhotoRepository.save() より先に呼ばれる', async () => {
      // Arrange
      const callOrder: string[] = [];
      const issue = Issue.reconstruct(
        IssueId.create('issue-001'),
        ProjectId.create('p1'),
        FloorId.create('floor-001'),
        'タイトル',
        '説明',
        IssueType.Quality,
        UserId.create('reporter-001'),
        Location.createFromDbId('elem-001'),
        IssuePriority.Medium,
        IssueStatus.InProgress,
        new Date('2026-12-31'),
        new Date('2026-01-01'),
        new Date('2026-01-01'),
        undefined
      );
      const issueRepo = createMockIssueRepository(issue);
      const photoStorage: PhotoStorage = {
        upload: vi.fn().mockImplementation(() => {
          callOrder.push('upload');
          return Promise.resolve();
        }),
        getUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      const photoRepo: IPhotoRepository = {
        save: vi.fn().mockImplementation(() => {
          callOrder.push('save');
          return Promise.resolve();
        }),
        findById: vi.fn().mockResolvedValue(null),
        findByIssueId: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      const handler = new AddPhotoHandler(issueRepo, photoStorage, photoRepo);

      // Act
      await handler.execute({
        issueId: 'issue-001',
        projectId: 'p1',
        file: Buffer.from('fake-image-data'),
        fileName: 'x.png',
        contentType: 'image/png',
        photoPhase: 'AFTER',
        uploadedBy: 'u1',
      });

      // Assert: upload が save より先に呼ばれている
      expect(callOrder).toEqual(['upload', 'save']);
      expect(callOrder.indexOf('upload')).toBeLessThan(callOrder.indexOf('save'));
    });
  });
});
