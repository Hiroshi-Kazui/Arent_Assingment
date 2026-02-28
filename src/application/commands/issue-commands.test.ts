import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CreateIssueHandler } from './create-issue';
import { UpdateIssueStatusHandler } from './update-issue-status';
import { PrismaIssueRepository } from '../../infrastructure/prisma/prisma-issue-repository';
import { listIssues } from '../queries/list-issues';
import { getIssueDetail } from '../queries/get-issue-detail';
import { IssueId } from '../../domain/models/issue';
import { ProjectId } from '../../domain/models/project';
import { CreateIssueInput } from '../dto/issue-dto';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition-error';
import prisma from '../../infrastructure/prisma/prisma-client';

describe('Issue Commands - 統合テスト', () => {
  const issueRepository = new PrismaIssueRepository();
  const createIssueHandler = new CreateIssueHandler(issueRepository);
  const updateStatusHandler = new UpdateIssueStatusHandler(
    issueRepository
  );

  const projectId = ProjectId.create(
    '22222222-2222-2222-2222-222222222222'
  );
  const floorId = '33333333-3333-3333-3333-333333333331';

  let createdIssueId: string;

  // テスト用 Issue を作成
  beforeAll(async () => {
    await prisma.building.upsert({
      where: { building_id: '11111111-1111-1111-1111-111111111111' },
      update: {},
      create: {
        building_id: '11111111-1111-1111-1111-111111111111',
        name: 'Aビル',
        address: 'Tokyo, Japan',
        latitude: '35.6762',
        longitude: '139.7674',
        model_urn: 'test-model-urn',
      },
    });

    await prisma.floor.upsert({
      where: { floor_id: floorId },
      update: {},
      create: {
        floor_id: floorId,
        building_id: '11111111-1111-1111-1111-111111111111',
        name: '1F',
        floor_number: 1,
      },
    });

    await prisma.project.upsert({
      where: { project_id: projectId },
      update: {},
      create: {
        project_id: projectId,
        building_id: '11111111-1111-1111-1111-111111111111',
        name: 'Aビル新築工事',
        start_date: new Date(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });

    const input: CreateIssueInput = {
      projectId: projectId,
      floorId: floorId,
      title: 'テスト指摘',
      description: 'テスト用の指摘です',
      issueType: 'structural',
      locationType: 'worldPosition',
      worldPositionX: 10.5,
      worldPositionY: 20.5,
      worldPositionZ: 30.5,
    };

    createdIssueId = await createIssueHandler.execute(input);
  });

  // テスト後のクリーンアップ
  afterAll(async () => {
    if (createdIssueId) {
      await prisma.issue.delete({
        where: { issue_id: createdIssueId },
      });
    }
  });

  describe('CreateIssue → list-issues の確認', () => {
    it('作成した Issue が list-issues で取得できる', async () => {
      const issues = await listIssues(projectId);

      const foundIssue = issues.find(
        (issue) => issue.issueId === createdIssueId
      );
      expect(foundIssue).toBeDefined();
      expect(foundIssue?.title).toBe('テスト指摘');
      expect(foundIssue?.status).toBe('OPEN');
      expect(foundIssue?.locationType).toBe('worldPosition');
      expect(foundIssue?.worldPositionX).toBe(10.5);
    });
  });

  describe('Issue 状態遷移 - 正常系', () => {
    it('Open → InProgress への遷移が成功', async () => {
      await updateStatusHandler.execute({
        issueId: createdIssueId,
        projectId: projectId,
        newStatus: 'IN_PROGRESS',
      });

      const detail = await getIssueDetail(
        IssueId.create(createdIssueId)
      );
      expect(detail?.status).toBe('IN_PROGRESS');
    });

    it('InProgress → Done への遷移が成功', async () => {
      // 前提：Open → InProgress 済み
      await updateStatusHandler.execute({
        issueId: createdIssueId,
        projectId: projectId,
        newStatus: 'DONE',
      });

      const detail = await getIssueDetail(
        IssueId.create(createdIssueId)
      );
      expect(detail?.status).toBe('DONE');
    });

    it('Done → InProgress への遷移が成功（再指摘）', async () => {
      // 前提：InProgress → Done 済み
      await updateStatusHandler.execute({
        issueId: createdIssueId,
        projectId: projectId,
        newStatus: 'IN_PROGRESS',
      });

      const detail = await getIssueDetail(
        IssueId.create(createdIssueId)
      );
      expect(detail?.status).toBe('IN_PROGRESS');
    });

    it('InProgress → Open への遷移が成功（差し戻し）', async () => {
      // 前提：Done → InProgress 済み
      await updateStatusHandler.execute({
        issueId: createdIssueId,
        projectId: projectId,
        newStatus: 'OPEN',
      });

      const detail = await getIssueDetail(
        IssueId.create(createdIssueId)
      );
      expect(detail?.status).toBe('OPEN');
    });
  });

  describe('Issue 状態遷移 - 不正系（ビジネスルール違反）', () => {
    it('Open → Done の直接遷移はエラー', async () => {
      // 前提：InProgress → Open 済みで、状態は OPEN

      const operation = async () => {
        await updateStatusHandler.execute({
          issueId: createdIssueId,
          projectId: projectId,
          newStatus: 'DONE',
        });
      };

      // Open状態ではcompleteが失敗するので、エラーが投げられる
      expect(operation).rejects.toThrow();
    });
  });

  describe('Issue 詳細取得', () => {
    it('Issue 詳細が取得できる', async () => {
      // 前提：状態はOPEN

      const detail = await getIssueDetail(
        IssueId.create(createdIssueId)
      );

      expect(detail).toBeDefined();
      expect(detail?.issueId).toBe(createdIssueId);
      expect(detail?.title).toBe('テスト指摘');
      expect(detail?.description).toBe('テスト用の指摘です');
      expect(detail?.floorId).toBe(floorId);
      expect(detail?.photos).toBeDefined();
      expect(Array.isArray(detail?.photos)).toBe(true);
    });
  });
});
