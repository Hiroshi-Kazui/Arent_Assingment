import { describe, it, expect } from 'vitest';
import {
  Issue,
  IssueId,
  IssueStatus,
  IssueType,
  IssuePriority,
} from './issue';
import { ProjectId } from './project';
import { FloorId } from './floor';
import { UserId } from './user';
import { Location } from './location';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition-error';

// テストヘルパー
function createTestLocation(): Location {
  return Location.createFromDbId('element-001');
}

function createTestIds() {
  return {
    issueId: IssueId.create('issue-001'),
    projectId: ProjectId.create('project-001'),
    floorId: FloorId.create('floor-001'),
    userId: UserId.create('user-001'),
    assigneeId: UserId.create('assignee-001'),
  };
}

function createTestIssue(status: IssueStatus, assigneeId?: UserId): Issue {
  const { issueId, projectId, floorId, userId } = createTestIds();
  return Issue.reconstruct(
    issueId,
    projectId,
    floorId,
    'テストタイトル',
    'テスト説明',
    IssueType.Quality,
    userId,
    createTestLocation(),
    IssuePriority.Medium,
    status,
    new Date('2026-12-31'),
    new Date('2026-01-01'),
    new Date('2026-01-01'),
    assigneeId
  );
}

describe('Issue 状態遷移', () => {
  describe('Issue.create() - 新規作成', () => {
    // DOM-ISS-001: Issue.create() でステータスが POINT_OUT で生成される
    it('Issue.create() でステータスが POINT_OUT で生成される', () => {
      // Arrange
      const { issueId, projectId, floorId, userId } = createTestIds();
      const location = createTestLocation();
      const dueDate = new Date('2026-12-31');

      // Act
      const issue = Issue.create(
        issueId,
        projectId,
        floorId,
        'タイトル',
        '説明',
        IssueType.Quality,
        userId,
        location,
        dueDate
      );

      // Assert
      expect(issue.status).toBe(IssueStatus.PointOut);
    });

    // DOM-ISS-013: Issue.create() でタイトル空文字を渡すと Error がスローされる
    it('タイトル空文字を渡すと Error がスローされる', () => {
      // Arrange
      const { issueId, projectId, floorId, userId } = createTestIds();
      const location = createTestLocation();
      const dueDate = new Date('2026-12-31');

      // Act & Assert
      expect(() =>
        Issue.create(issueId, projectId, floorId, '', '説明', undefined, userId, location, dueDate)
      ).toThrow('Issue title must not be empty');
    });

    // DOM-ISS-014: Issue.create() で無効な dueDate を渡すと Error がスローされる
    it('無効な dueDate を渡すと Error がスローされる', () => {
      // Arrange
      const { issueId, projectId, floorId, userId } = createTestIds();
      const location = createTestLocation();

      // Act & Assert
      expect(() =>
        Issue.create(
          issueId,
          projectId,
          floorId,
          'タイトル',
          '説明',
          undefined,
          userId,
          location,
          new Date('invalid')
        )
      ).toThrow('Issue dueDate is invalid');
    });
  });

  describe('Issue.createWithAssignee() - 担当者付き新規作成', () => {
    // DOM-ISS-012: createWithAssignee() で status=Open かつ assigneeId が設定される
    it('createWithAssignee() で status=Open かつ assigneeId が設定される', () => {
      // Arrange
      const { issueId, projectId, floorId, userId, assigneeId } = createTestIds();
      const location = createTestLocation();
      const dueDate = new Date('2026-12-31');

      // Act
      const issue = Issue.createWithAssignee(
        issueId,
        projectId,
        floorId,
        'タイトル',
        '説明',
        undefined,
        userId,
        location,
        dueDate,
        assigneeId
      );

      // Assert
      expect(issue.status).toBe(IssueStatus.Open);
      expect(issue.assigneeId).toBe(assigneeId);
    });
  });

  describe('assignTo() - PointOut → Open', () => {
    // DOM-ISS-002: PointOut → Open への遷移 (assignTo 正常系)
    it('PointOut → Open への遷移が成功し assigneeId が設定される', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.PointOut);
      const assigneeId = UserId.create('new-assignee-001');

      // Act
      const result = issue.assignTo(assigneeId);

      // Assert
      expect(result.status).toBe(IssueStatus.Open);
      expect(result.assigneeId).toBe(assigneeId);
    });
  });

  describe('startWork() - Open → InProgress', () => {
    // DOM-ISS-003: Open → InProgress への遷移 (startWork 正常系)
    it('Open → InProgress への遷移が成功する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Open);

      // Act
      const result = issue.startWork();

      // Assert
      expect(result.status).toBe(IssueStatus.InProgress);
    });

    // DOM-ISS-004: startWork() を Open 以外から呼ぶと InvalidStatusTransitionError が発生する
    it('PointOut 状態から startWork() を呼ぶと InvalidStatusTransitionError が発生する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.PointOut);

      // Act & Assert
      expect(() => issue.startWork()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('complete() - InProgress → Done', () => {
    // DOM-ISS-005: InProgress → Done への遷移 (complete 正常系)
    it('InProgress → Done への遷移が成功する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.InProgress);

      // Act
      const result = issue.complete();

      // Assert
      expect(result.status).toBe(IssueStatus.Done);
    });

    // DOM-ISS-006: complete() を InProgress 以外から呼ぶと InvalidStatusTransitionError が発生する
    it('Open 状態から complete() を呼ぶと InvalidStatusTransitionError が発生する (Open → Done 直接遷移禁止)', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Open);

      // Act & Assert
      expect(() => issue.complete()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('rejectWork() - InProgress → Open', () => {
    // DOM-ISS-007: InProgress → Open への遷移 (rejectWork 正常系)
    it('InProgress → Open への差し戻しが成功する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.InProgress);

      // Act
      const result = issue.rejectWork();

      // Assert
      expect(result.status).toBe(IssueStatus.Open);
    });
  });

  describe('confirm() - Done → Confirmed', () => {
    // DOM-ISS-008: Done → Confirmed への遷移 (confirm 正常系)
    it('Done → Confirmed への遷移が成功する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Done);

      // Act
      const result = issue.confirm();

      // Assert
      expect(result.status).toBe(IssueStatus.Confirmed);
    });
  });

  describe('rejectCompletion() - Done → Open', () => {
    // DOM-ISS-009: Done → Open への遷移 (rejectCompletion 正常系)
    it('Done → Open への否認遷移が成功する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Done);

      // Act
      const result = issue.rejectCompletion();

      // Assert
      expect(result.status).toBe(IssueStatus.Open);
    });
  });

  describe('reissue() - Confirmed → Open', () => {
    // DOM-ISS-010: Confirmed → Open への遷移 (reissue 正常系)
    it('Confirmed → Open への再指摘遷移が成功する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Confirmed);

      // Act
      const result = issue.reissue();

      // Assert
      expect(result.status).toBe(IssueStatus.Open);
    });
  });

  describe('reopenAfterCompletion() - Done → InProgress', () => {
    // DOM-ISS-011: Done → InProgress への遷移 (reopenAfterCompletion 正常系)
    it('Done → InProgress への再指摘遷移が成功する', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.Done);

      // Act
      const result = issue.reopenAfterCompletion();

      // Assert
      expect(result.status).toBe(IssueStatus.InProgress);
    });
  });

  describe('changeAssignee() - 担当者変更', () => {
    // DOM-ASG-001: changeAssignee() が PointOut 状態の Issue を Open に遷移させる
    it('PointOut 状態の Issue で changeAssignee() を呼ぶと Open に遷移し assigneeId が更新される', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.PointOut);
      const newAssigneeId = UserId.create('new-assignee-999');

      // Act
      const result = issue.changeAssignee(newAssigneeId);

      // Assert
      expect(result.status).toBe(IssueStatus.Open);
      expect(result.assigneeId).toBe(newAssigneeId);
    });

    // DOM-ISS-015: InProgress 中の assignee 変更は InvalidStatusTransitionError
    it('InProgress 状態で changeAssignee() を呼ぶと InvalidStatusTransitionError がスローされる', () => {
      // Arrange
      const issue = createTestIssue(IssueStatus.InProgress);
      const newAssigneeId = UserId.create('new-assignee-002');

      // Act & Assert
      expect(() => issue.changeAssignee(newAssigneeId)).toThrow(InvalidStatusTransitionError);
    });
  });
});

describe('IssuePriority', () => {
  // DOM-DOM-006: Issue に IssuePriority (Low/Medium/High/Critical) が設定できる
  it('Issue.create() で priority=High を指定すると priority が High になる', () => {
    // Arrange
    const { issueId, projectId, floorId, userId } = createTestIds();
    const location = createTestLocation();
    const dueDate = new Date('2026-12-31');

    // Act
    const issue = Issue.create(
      issueId,
      projectId,
      floorId,
      'タイトル',
      '説明',
      undefined,
      userId,
      location,
      dueDate,
      IssuePriority.High
    );

    // Assert
    expect(issue.priority).toBe(IssuePriority.High);
  });
});
