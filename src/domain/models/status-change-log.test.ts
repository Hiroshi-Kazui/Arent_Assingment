import { describe, it, expect } from 'vitest';
import { StatusChangeLog, StatusChangeLogId } from './status-change-log';
import { IssueId, IssueStatus } from './issue';
import { UserId } from './user';

describe('StatusChangeLog ドメインモデル', () => {
  describe('StatusChangeLog.create()', () => {
    // DOM-DOM-007: StatusChangeLog.create() で変更ログが生成される
    it('fromStatus と toStatus が正しく設定された StatusChangeLog が生成される', () => {
      // Arrange
      const logId = StatusChangeLogId.create('log-001');
      const issueId = IssueId.create('issue-001');
      const userId = UserId.create('user-001');

      // Act
      const log = StatusChangeLog.create(
        logId,
        issueId,
        IssueStatus.Open,
        IssueStatus.InProgress,
        userId,
        undefined
      );

      // Assert
      expect(log.fromStatus).toBe(IssueStatus.Open);
      expect(log.toStatus).toBe(IssueStatus.InProgress);
    });

    it('コメント付きで StatusChangeLog が生成される', () => {
      // Arrange
      const logId = StatusChangeLogId.create('log-002');
      const issueId = IssueId.create('issue-001');
      const userId = UserId.create('user-001');

      // Act
      const log = StatusChangeLog.create(
        logId,
        issueId,
        IssueStatus.Done,
        IssueStatus.Open,
        userId,
        '再指摘します'
      );

      // Assert
      expect(log.comment).toBe('再指摘します');
      expect(log.changedBy).toBe(userId);
    });
  });
});
