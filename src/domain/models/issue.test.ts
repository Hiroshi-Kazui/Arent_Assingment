import { describe, it, expect } from 'vitest';
import {
  Issue,
  IssueId,
  IssueStatus,
  IssuePriority,
  IssueType,
} from './issue';
import { Location } from './location';
import { ProjectId } from './project';
import { FloorId } from './floor';
import { UserId } from './user';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition-error';

describe('Issue - 状態遷移ロジック', () => {
  // テストで使用するテストダブル
  const createTestIssue = (
    status: IssueStatus = IssueStatus.PointOut,
    assigneeId?: string
  ): Issue => {
    const id = IssueId.create('issue-001');
    const projectId = ProjectId.create('project-001');
    const floorId = FloorId.create('floor-001');
    const location = Location.createFromWorldPosition(0, 0, 0);

    if (status === IssueStatus.PointOut) {
      return Issue.create(
        id,
        projectId,
        floorId,
        'Test Issue',
        'Description',
        IssueType.Quality,
        UserId.create('user-001'),
        location,
        new Date()
      );
    }

    // 他のステータスで復元
    return Issue.reconstruct(
      id,
      projectId,
      floorId,
      'Test Issue',
      'Description',
      IssueType.Quality,
      UserId.create('user-001'),
      location,
      IssuePriority.Medium,
      status,
      new Date(),
      new Date(),
      new Date(),
      assigneeId ? UserId.create(assigneeId) : undefined
    );
  };

  describe('正常な状態遷移', () => {
    it('PointOut → Open（assignTo: Assignee設定）', () => {
      const issue = createTestIssue(IssueStatus.PointOut);
      const assigneeId = UserId.create('assignee-001');
      const updatedIssue = issue.assignTo(assigneeId);

      expect(updatedIssue.status).toBe(IssueStatus.Open);
      expect(updatedIssue.isOpen()).toBe(true);
      expect(updatedIssue.isPointOut()).toBe(false);
      expect(updatedIssue.assigneeId).toBe(assigneeId);
    });

    it('Open → InProgress（着手）', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');
      const updatedIssue = issue.startWork();

      expect(updatedIssue.status).toBe(IssueStatus.InProgress);
      expect(updatedIssue.isInProgress()).toBe(true);
      expect(updatedIssue.isOpen()).toBe(false);
    });

    it('InProgress → Done（是正完了）', () => {
      const issue = createTestIssue(IssueStatus.InProgress, 'assignee-001');
      const updatedIssue = issue.complete();

      expect(updatedIssue.status).toBe(IssueStatus.Done);
      expect(updatedIssue.isDone()).toBe(true);
      expect(updatedIssue.isInProgress()).toBe(false);
    });

    it('InProgress → Open（差し戻し）', () => {
      const issue = createTestIssue(IssueStatus.InProgress, 'assignee-001');
      const updatedIssue = issue.rejectWork();

      expect(updatedIssue.status).toBe(IssueStatus.Open);
      expect(updatedIssue.isOpen()).toBe(true);
      expect(updatedIssue.isInProgress()).toBe(false);
    });

    it('Done → InProgress（再指摘）', () => {
      const issue = createTestIssue(IssueStatus.Done, 'assignee-001');
      const updatedIssue = issue.reopenAfterCompletion();

      expect(updatedIssue.status).toBe(IssueStatus.InProgress);
      expect(updatedIssue.isInProgress()).toBe(true);
      expect(updatedIssue.isDone()).toBe(false);
    });

    it('Done → Confirmed（confirm: Supervisor承認）', () => {
      const issue = createTestIssue(IssueStatus.Done, 'assignee-001');
      const updatedIssue = issue.confirm();

      expect(updatedIssue.status).toBe(IssueStatus.Confirmed);
      expect(updatedIssue.isConfirmed()).toBe(true);
      expect(updatedIssue.isDone()).toBe(false);
    });

    it('Done → Open（rejectCompletion: 否認）', () => {
      const issue = createTestIssue(IssueStatus.Done, 'assignee-001');
      const updatedIssue = issue.rejectCompletion();

      expect(updatedIssue.status).toBe(IssueStatus.Open);
      expect(updatedIssue.isOpen()).toBe(true);
      expect(updatedIssue.isDone()).toBe(false);
    });

    it('Confirmed → Open（reissue: 再指摘）', () => {
      const issue = createTestIssue(IssueStatus.Confirmed, 'assignee-001');
      const updatedIssue = issue.reissue();

      expect(updatedIssue.status).toBe(IssueStatus.Open);
      expect(updatedIssue.isOpen()).toBe(true);
      expect(updatedIssue.isConfirmed()).toBe(false);
    });
  });

  describe('不正な状態遷移（ビジネスルール違反）', () => {
    it('Open → Done は禁止', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');
      expect(() => issue.complete()).toThrow(InvalidStatusTransitionError);
    });

    it('Open → Open（同じ状態への遷移）は不正', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');
      expect(() => issue.rejectWork()).toThrow(InvalidStatusTransitionError);
    });

    it('Done → Open（rejectWorkは不可、rejectCompletionを使う）', () => {
      const issue = createTestIssue(IssueStatus.Done, 'assignee-001');
      expect(() => issue.rejectWork()).toThrow(InvalidStatusTransitionError);
    });

    it('Done → Done（同じ状態への遷移）は不正', () => {
      const issue = createTestIssue(IssueStatus.Done, 'assignee-001');
      expect(() => issue.complete()).toThrow(InvalidStatusTransitionError);
    });

    it('InProgress → InProgress（同じ状態への遷移）は不正', () => {
      const issue = createTestIssue(IssueStatus.InProgress, 'assignee-001');
      expect(() => issue.startWork()).toThrow(InvalidStatusTransitionError);
    });

    it('Open → Confirmed は禁止', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');
      expect(() => issue.confirm()).toThrow(InvalidStatusTransitionError);
    });

    it('Open → assignTo は禁止（PointOutからのみ）', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');
      expect(() => issue.assignTo(UserId.create('new-assignee'))).toThrow(InvalidStatusTransitionError);
    });

    it('InProgress → Confirmed は禁止', () => {
      const issue = createTestIssue(IssueStatus.InProgress, 'assignee-001');
      expect(() => issue.confirm()).toThrow(InvalidStatusTransitionError);
    });

    it('Confirmed → Confirmed は不正', () => {
      const issue = createTestIssue(IssueStatus.Confirmed, 'assignee-001');
      expect(() => issue.confirm()).toThrow(InvalidStatusTransitionError);
    });

    it('PointOut → InProgress は禁止', () => {
      const issue = createTestIssue(IssueStatus.PointOut);
      expect(() => issue.startWork()).toThrow(InvalidStatusTransitionError);
    });

    it('PointOut → Done は禁止（直接完了不可）', () => {
      const issue = createTestIssue(IssueStatus.PointOut);
      expect(() => issue.complete()).toThrow(InvalidStatusTransitionError);
    });

    it('Confirmed → InProgress は禁止（reopenAfterCompletion不可）', () => {
      const issue = createTestIssue(IssueStatus.Confirmed, 'assignee-001');
      expect(() => issue.reopenAfterCompletion()).toThrow(InvalidStatusTransitionError);
    });

    it('Confirmed → Done は禁止', () => {
      const issue = createTestIssue(IssueStatus.Confirmed, 'assignee-001');
      expect(() => issue.complete()).toThrow(InvalidStatusTransitionError);
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
        IssueType.Quality,
        UserId.create('user-001'),
        location,
        new Date()
      );

      const assigneeId = UserId.create('assignee-001');
      const open = issue.assignTo(assigneeId);
      const inProgress = open.startWork();
      const done = inProgress.complete();

      expect(done.id).toBe(id);
      expect(done.projectId).toBe(projectId);
      expect(done.floorId).toBe(floorId);
      expect(done.title).toBe(title);
      expect(done.description).toBe(description);
      expect(done.location).toBe(location);
      expect(done.assigneeId).toBe(assigneeId);
    });

    it('状態遷移時に createdAt は変わらない', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');
      const originalCreatedAt = issue.createdAt;

      const inProgress = issue.startWork();
      const done = inProgress.complete();

      expect(done.createdAt).toBe(originalCreatedAt);
    });

    it('状態遷移時に updatedAt は更新される', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');
      const originalUpdatedAt = issue.updatedAt;

      const inProgress = issue.startWork();

      expect(inProgress.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe('ヘルパーメソッド', () => {
    it('isPointOut() は PointOut 状態で true', () => {
      const issue = createTestIssue(IssueStatus.PointOut);
      expect(issue.isPointOut()).toBe(true);
      expect(issue.isOpen()).toBe(false);
    });

    it('isConfirmed() は Confirmed 状態で true', () => {
      const issue = createTestIssue(IssueStatus.Confirmed, 'assignee-001');
      expect(issue.isConfirmed()).toBe(true);
      expect(issue.isDone()).toBe(false);
    });
  });

  describe('優先度変更', () => {
    it('任意の状態で優先度を変更できる', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');

      const updatedIssue = issue.changePriority(IssuePriority.Critical);

      expect(updatedIssue.priority).toBe(IssuePriority.Critical);
      expect(updatedIssue.status).toBe(IssueStatus.Open);
    });
  });

  describe('完全ライフサイクル', () => {
    it('PointOut → Open → InProgress → Done → Confirmed の全遷移', () => {
      const issue = createTestIssue(IssueStatus.PointOut);
      const assigneeId = UserId.create('assignee-001');

      const open = issue.assignTo(assigneeId);
      expect(open.status).toBe(IssueStatus.Open);

      const inProgress = open.startWork();
      expect(inProgress.status).toBe(IssueStatus.InProgress);

      const done = inProgress.complete();
      expect(done.status).toBe(IssueStatus.Done);

      const confirmed = done.confirm();
      expect(confirmed.status).toBe(IssueStatus.Confirmed);
    });

    it('差し戻しループ: Open → InProgress → Open → InProgress → Done', () => {
      const issue = createTestIssue(IssueStatus.Open, 'assignee-001');

      const inProgress1 = issue.startWork();
      const rejected = inProgress1.rejectWork();
      expect(rejected.status).toBe(IssueStatus.Open);

      const inProgress2 = rejected.startWork();
      const done = inProgress2.complete();
      expect(done.status).toBe(IssueStatus.Done);
    });

    it('再指摘ループ: Done → Confirmed → Open → InProgress → Done', () => {
      const issue = createTestIssue(IssueStatus.Confirmed, 'assignee-001');

      const reissued = issue.reissue();
      expect(reissued.status).toBe(IssueStatus.Open);

      const inProgress = reissued.startWork();
      const done = inProgress.complete();
      expect(done.status).toBe(IssueStatus.Done);
    });
  });

  describe('新規作成', () => {
    it('create() は PointOut ステータスで作成される', () => {
      const issue = Issue.create(
        IssueId.create('issue-001'),
        ProjectId.create('project-001'),
        FloorId.create('floor-001'),
        'Test Issue',
        'Description',
        IssueType.Quality,
        UserId.create('user-001'),
        Location.createFromWorldPosition(0, 0, 0),
        new Date()
      );

      expect(issue.status).toBe(IssueStatus.PointOut);
      expect(issue.isPointOut()).toBe(true);
      expect(issue.assigneeId).toBeUndefined();
    });
  });
});
