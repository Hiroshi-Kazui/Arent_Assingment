import { describe, it, expect } from 'vitest';
import {
  Issue,
  IssueId,
  IssueStatus,
  IssuePriority,
} from './issue';
import { Location } from './location';
import { ProjectId } from './project';
import { FloorId } from './floor';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition-error';

describe('Issue - 状態遷移ロジック', () => {
  // テストで使用するテストダブル
  const createTestIssue = (
    status: IssueStatus = IssueStatus.Open
  ): Issue => {
    const id = IssueId.create('issue-001');
    const projectId = ProjectId.create('project-001');
    const floorId = FloorId.create('floor-001');
    const location = Location.createFromWorldPosition(0, 0, 0);

    if (status === IssueStatus.Open) {
      return Issue.create(
        id,
        projectId,
        floorId,
        'Test Issue',
        'Description',
        'quality',
        'tester',
        location
      );
    }

    // 他のステータスで復元
    return Issue.reconstruct(
      id,
      projectId,
      floorId,
      'Test Issue',
      'Description',
      'quality',
      'tester',
      location,
      IssuePriority.Medium,
      status,
      new Date(),
      new Date()
    );
  };

  describe('正常な状態遷移', () => {
    it('Open → InProgress（着手）', () => {
      const issue = createTestIssue(IssueStatus.Open);
      const updatedIssue = issue.startWork();

      expect(updatedIssue.status).toBe(IssueStatus.InProgress);
      expect(updatedIssue.isInProgress()).toBe(true);
      expect(updatedIssue.isOpen()).toBe(false);
    });

    it('InProgress → Done（是正完了）', () => {
      const issue = createTestIssue(IssueStatus.InProgress);
      const updatedIssue = issue.complete();

      expect(updatedIssue.status).toBe(IssueStatus.Done);
      expect(updatedIssue.isDone()).toBe(true);
      expect(updatedIssue.isInProgress()).toBe(false);
    });

    it('InProgress → Open（差し戻し）', () => {
      const issue = createTestIssue(IssueStatus.InProgress);
      const updatedIssue = issue.rejectWork();

      expect(updatedIssue.status).toBe(IssueStatus.Open);
      expect(updatedIssue.isOpen()).toBe(true);
      expect(updatedIssue.isInProgress()).toBe(false);
    });

    it('Done → InProgress（再指摘）', () => {
      const issue = createTestIssue(IssueStatus.Done);
      const updatedIssue = issue.reopenAfterCompletion();

      expect(updatedIssue.status).toBe(IssueStatus.InProgress);
      expect(updatedIssue.isInProgress()).toBe(true);
      expect(updatedIssue.isDone()).toBe(false);
    });
  });

  describe('不正な状態遷移（ビジネスルール違反）', () => {
    it('Open → Done は禁止', () => {
      const issue = createTestIssue(IssueStatus.Open);

      // Open 状態から Done に直接遷移することはできない
      // complete() メソッドは InProgress 状態でのみ呼び出し可能
      expect(() => issue.complete()).toThrow(
        InvalidStatusTransitionError
      );
    });

    it('Open → Open（同じ状態への遷移）は不正', () => {
      const issue = createTestIssue(IssueStatus.Open);

      // rejectWork は InProgress からのみ実行可能
      expect(() => issue.rejectWork()).toThrow(
        InvalidStatusTransitionError
      );
    });

    it('Done → Open は禁止', () => {
      const issue = createTestIssue(IssueStatus.Done);

      // rejectWork は InProgress からのみ実行可能
      expect(() => issue.rejectWork()).toThrow(
        InvalidStatusTransitionError
      );
    });

    it('Done → Done（同じ状態への遷移）は不正', () => {
      const issue = createTestIssue(IssueStatus.Done);

      // complete は InProgress からのみ実行可能
      expect(() => issue.complete()).toThrow(
        InvalidStatusTransitionError
      );
    });

    it('InProgress → InProgress（同じ状態への遷移）は不正', () => {
      const issue = createTestIssue(IssueStatus.InProgress);

      // startWork は Open からのみ実行可能
      expect(() => issue.startWork()).toThrow(
        InvalidStatusTransitionError
      );
    });
  });

  describe('状態遷移時の属性保持', () => {
    it('状態遷移時に id, projectId, title, description は変わらない', () => {
      const id = IssueId.create('issue-001');
      const projectId = ProjectId.create('project-001');
      const floorId = FloorId.create('floor-001');
      const location = Location.createFromWorldPosition(1, 2, 3);
      const title = 'Test Issue Title';
      const description = 'Test Description';

      const issue = Issue.create(
        id,
        projectId,
        floorId,
        title,
        description,
        'quality',
        'tester',
        location
      );

      const inProgress = issue.startWork();
      const done = inProgress.complete();

      expect(done.id).toBe(id);
      expect(done.projectId).toBe(projectId);
      expect(done.floorId).toBe(floorId);
      expect(done.title).toBe(title);
      expect(done.description).toBe(description);
      expect(done.location).toBe(location);
    });

    it('状態遷移時に createdAt は変わらない', () => {
      const issue = createTestIssue(IssueStatus.Open);
      const originalCreatedAt = issue.createdAt;

      const inProgress = issue.startWork();
      const done = inProgress.complete();

      expect(done.createdAt).toBe(originalCreatedAt);
    });

    it('状態遷移時に updatedAt は更新される', () => {
      const issue = createTestIssue(IssueStatus.Open);
      const originalUpdatedAt = issue.updatedAt;

      // 少し待機してから状態遷移（時刻が確実に異なるようにするため）
      const inProgress = issue.startWork();

      expect(inProgress.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe('優先度変更', () => {
    it('任意の状態で優先度を変更できる', () => {
      const issue = createTestIssue(IssueStatus.Open);

      const updatedIssue = issue.changePriority(IssuePriority.Critical);

      expect(updatedIssue.priority).toBe(IssuePriority.Critical);
      expect(updatedIssue.status).toBe(IssueStatus.Open);
    });
  });
});
