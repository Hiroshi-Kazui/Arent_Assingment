import { test, expect } from './fixtures/auth';
import { SEED } from './fixtures/test-data';

// ────────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────────

function createMinimalPng(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
}

/**
 * Supervisor 認証済みページを使って Issue を作成し issueId を返す。
 * 指摘登録時には BEFORE 写真が必須なので multipart で送信する。
 */
async function createIssue(
  supervisorPage: import('@playwright/test').Page,
  title: string,
): Promise<string> {
  const response = await supervisorPage.request.post(
    `/api/projects/${SEED.PROJECT_ID}/issues`,
    {
      multipart: {
        floorId: SEED.FLOOR_1F_ID,
        title,
        description: 'E2E テスト用の説明',
        locationType: 'dbId',
        dbId: '100',
        dueDate: '2026-12-31',
        photoPhase: 'BEFORE',
        file: {
          name: 'before.png',
          mimeType: 'image/png',
          buffer: createMinimalPng(),
        },
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.issueId).toBeDefined();
  return body.issueId as string;
}

// ────────────────────────────────────────────────
// テストスイート
// ────────────────────────────────────────────────

test.describe('Issue ライフサイクル', () => {
  const createdIds: string[] = [];

  test.afterEach(async ({ supervisorPage }) => {
    // 作成した Issue をクリーンアップ
    for (const id of createdIds.splice(0)) {
      await supervisorPage.request.delete(
        `/api/projects/${SEED.PROJECT_ID}/issues/${id}`,
      );
    }
  });

  // E2E-ISS-001: Issue 作成から Done 遷移までの一連のフロー
  test('Supervisor が Issue を作成し Worker が Done まで遷移させる', async ({
    supervisorPage,
    workerPage,
  }) => {
    // Step 1: POST /api/projects/{id}/issues (BEFORE 写真付き)
    const issueId = await createIssue(supervisorPage, 'E2E-ISS-001 テスト指摘');
    createdIds.push(issueId);

    // Step 2: PATCH assignee（PointOut → Open 遷移 + Worker 担当設定）
    const assignRes = await supervisorPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/assignee`,
      {
        data: { assigneeId: SEED.WORKER_USER_ID },
      },
    );
    expect(assignRes.ok()).toBeTruthy();

    // Step 3: Worker として IN_PROGRESS に変更
    const startRes = await workerPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      {
        data: { status: 'IN_PROGRESS' },
      },
    );
    expect(startRes.ok()).toBeTruthy();
    expect(startRes.status()).toBe(200);

    // Step 4: Worker として AFTER 写真をアップロード
    const photoRes = await workerPage.request.post(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/photos`,
      {
        multipart: {
          photoPhase: 'AFTER',
          file: {
            name: 'after.png',
            mimeType: 'image/png',
            buffer: createMinimalPng(),
          },
        },
      },
    );
    expect(photoRes.ok()).toBeTruthy();
    expect(photoRes.status()).toBe(201);

    // Step 5: Worker として DONE に変更
    const doneRes = await workerPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      {
        data: { status: 'DONE' },
      },
    );
    expect(doneRes.ok()).toBeTruthy();
    expect(doneRes.status()).toBe(200);

    // 最終確認: Issue の status が DONE であること
    const issueRes = await supervisorPage.request.get(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}`,
    );
    expect(issueRes.ok()).toBeTruthy();
    const issue = await issueRes.json();
    expect(issue.status).toBe('DONE');
  });

  // E2E-ISS-002: Issue 承認フロー (Done → Confirmed)
  test('Supervisor が Done 状態の Issue を Confirmed に承認できる', async ({
    supervisorPage,
    workerPage,
  }) => {
    // 前提: DONE 状態の Issue を準備
    const issueId = await createIssue(supervisorPage, 'E2E-ISS-002 承認テスト指摘');
    createdIds.push(issueId);

    // PointOut → Open（担当者設定）
    const assignRes = await supervisorPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/assignee`,
      { data: { assigneeId: SEED.WORKER_USER_ID } },
    );
    expect(assignRes.ok()).toBeTruthy();

    // Open → InProgress
    const startRes = await workerPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      { data: { status: 'IN_PROGRESS' } },
    );
    expect(startRes.ok()).toBeTruthy();

    // AFTER 写真をアップロード（Done 遷移の前提条件）
    const photoRes = await workerPage.request.post(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/photos`,
      {
        multipart: {
          photoPhase: 'AFTER',
          file: {
            name: 'after.png',
            mimeType: 'image/png',
            buffer: createMinimalPng(),
          },
        },
      },
    );
    expect(photoRes.ok()).toBeTruthy();

    // InProgress → Done
    const doneRes = await workerPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      { data: { status: 'DONE' } },
    );
    expect(doneRes.ok()).toBeTruthy();

    // Done → Confirmed（Supervisor が承認）
    const confirmRes = await supervisorPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      { data: { status: 'CONFIRMED' } },
    );
    expect(confirmRes.ok()).toBeTruthy();
    expect(confirmRes.status()).toBe(200);

    // 最終確認: status が CONFIRMED であること
    const issueRes = await supervisorPage.request.get(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}`,
    );
    expect(issueRes.ok()).toBeTruthy();
    const issue = await issueRes.json();
    expect(issue.status).toBe('CONFIRMED');
  });

  // E2E-ISS-003: Issue 再指摘フロー (Confirmed → Open)
  test('Supervisor が Confirmed 状態の Issue に再指摘して Open に戻せる', async ({
    supervisorPage,
    workerPage,
  }) => {
    // 前提: CONFIRMED 状態の Issue を準備
    const issueId = await createIssue(supervisorPage, 'E2E-ISS-003 再指摘テスト指摘');
    createdIds.push(issueId);

    // PointOut → Open
    await supervisorPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/assignee`,
      { data: { assigneeId: SEED.WORKER_USER_ID } },
    );

    // Open → InProgress
    await workerPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      { data: { status: 'IN_PROGRESS' } },
    );

    // AFTER 写真
    await workerPage.request.post(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/photos`,
      {
        multipart: {
          photoPhase: 'AFTER',
          file: { name: 'after.png', mimeType: 'image/png', buffer: createMinimalPng() },
        },
      },
    );

    // InProgress → Done
    await workerPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      { data: { status: 'DONE' } },
    );

    // Done → Confirmed
    await supervisorPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      { data: { status: 'CONFIRMED' } },
    );

    // Step 1 (再指摘): REJECTION 写真をアップロード
    const rejectionPhotoRes = await supervisorPage.request.post(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/photos`,
      {
        multipart: {
          photoPhase: 'REJECTION',
          file: {
            name: 'rejection.png',
            mimeType: 'image/png',
            buffer: createMinimalPng(),
          },
        },
      },
    );
    expect(rejectionPhotoRes.ok()).toBeTruthy();
    expect(rejectionPhotoRes.status()).toBe(201);

    // Step 2 (再指摘): Confirmed → Open に戻す
    const reopenRes = await supervisorPage.request.patch(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}/status`,
      { data: { status: 'OPEN', comment: '再指摘します' } },
    );
    expect(reopenRes.ok()).toBeTruthy();
    expect(reopenRes.status()).toBe(200);

    // 最終確認: status が OPEN であること
    const issueRes = await supervisorPage.request.get(
      `/api/projects/${SEED.PROJECT_ID}/issues/${issueId}`,
    );
    expect(issueRes.ok()).toBeTruthy();
    const issue = await issueRes.json();
    expect(issue.status).toBe('OPEN');
  });
});
