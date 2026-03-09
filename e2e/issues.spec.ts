import { test, expect } from './fixtures/auth';
import { SEED } from './fixtures/test-data';

const BASE = `/api/projects/${SEED.PROJECT_ID}/issues`;

function createMinimalPng(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

async function createIssue(request: any, title: string): Promise<string> {
  const res = await request.post(BASE, {
    multipart: {
      floorId: SEED.FLOOR_1F_ID,
      title,
      description: 'E2E test issue',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      locationType: 'dbId',
      dbId: '100',
      photoPhase: 'BEFORE',
      files: { name: 'test.png', mimeType: 'image/png', buffer: createMinimalPng() },
    },
  });
  expect(res.ok(), `Issue creation failed: ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return body.issueId;
}

test.describe('Issue lifecycle', () => {
  const createdIssueIds: string[] = [];

  test.afterEach(async ({ supervisorPage }) => {
    for (const id of createdIssueIds.splice(0)) {
      await supervisorPage.request.delete(`${BASE}/${id}`).catch(() => {});
    }
  });

  test('create issue via API and verify it appears in list', async ({ supervisorPage }) => {
    const issueId = await createIssue(supervisorPage.request, 'E2E create test');
    createdIssueIds.push(issueId);

    const res = await supervisorPage.request.get(BASE);
    const body = await res.json();
    expect(body.items.some((i: any) => i.issueId === issueId)).toBeTruthy();
  });

  test('full status transition POINT_OUT→OPEN→IN_PROGRESS→DONE→CONFIRMED', async ({ supervisorPage, browser }) => {
    const issueId = await createIssue(supervisorPage.request, 'Status transition test');
    createdIssueIds.push(issueId);

    // POINT_OUT → OPEN via assign (supervisor assigns worker)
    const assignRes = await supervisorPage.request.patch(`${BASE}/${issueId}/assignee`, {
      data: { assigneeId: SEED.WORKER_USER_ID },
    });
    expect(assignRes.ok(), `Assign failed: ${await assignRes.text()}`).toBeTruthy();

    // OPEN → IN_PROGRESS / DONE: only assignee (worker) can do these
    const workerCtx = await browser.newContext({ storageState: 'e2e/.auth/worker.json' });
    const workerPage = await workerCtx.newPage();

    let r = await workerPage.request.patch(`${BASE}/${issueId}/status`, {
      data: { status: 'IN_PROGRESS' },
    });
    expect(r.ok(), `IN_PROGRESS failed: ${await r.text()}`).toBeTruthy();

    // Upload AFTER photo (required before DONE)
    await workerPage.request.post(`${BASE}/${issueId}/photos`, {
      multipart: {
        photoPhase: 'AFTER',
        files: { name: 'after.png', mimeType: 'image/png', buffer: createMinimalPng() },
      },
    });

    r = await workerPage.request.patch(`${BASE}/${issueId}/status`, {
      data: { status: 'DONE' },
    });
    expect(r.ok(), `DONE failed: ${await r.text()}`).toBeTruthy();
    await workerCtx.close();

    // DONE → CONFIRMED: supervisor can do this (worker is blocked)
    r = await supervisorPage.request.patch(`${BASE}/${issueId}/status`, {
      data: { status: 'CONFIRMED' },
    });
    expect(r.ok(), `CONFIRMED failed: ${await r.text()}`).toBeTruthy();
  });

  test('invalid transition POINT_OUT→DONE is rejected', async ({ supervisorPage }) => {
    const issueId = await createIssue(supervisorPage.request, 'Invalid transition test');
    createdIssueIds.push(issueId);

    const r = await supervisorPage.request.patch(`${BASE}/${issueId}/status`, {
      data: { status: 'DONE' },
    });
    expect(r.ok()).toBeFalsy();
  });

  test('worker cannot confirm issue (DONE→CONFIRMED returns 403)', async ({ supervisorPage, browser }) => {
    const issueId = await createIssue(supervisorPage.request, 'Worker confirm test');
    createdIssueIds.push(issueId);

    // Advance to DONE using worker (assignee)
    await supervisorPage.request.patch(`${BASE}/${issueId}/assignee`, {
      data: { assigneeId: SEED.WORKER_USER_ID },
    });

    const workerCtx = await browser.newContext({ storageState: 'e2e/.auth/worker.json' });
    const workerPage = await workerCtx.newPage();

    await workerPage.request.patch(`${BASE}/${issueId}/status`, { data: { status: 'IN_PROGRESS' } });
    await workerPage.request.post(`${BASE}/${issueId}/photos`, {
      multipart: {
        photoPhase: 'AFTER',
        files: { name: 'after.png', mimeType: 'image/png', buffer: createMinimalPng() },
      },
    });
    await workerPage.request.patch(`${BASE}/${issueId}/status`, { data: { status: 'DONE' } });

    // Worker tries CONFIRMED → should be 403
    const r = await workerPage.request.patch(`${BASE}/${issueId}/status`, {
      data: { status: 'CONFIRMED' },
    });
    expect(r.status()).toBe(403);
    await workerCtx.close();
  });

  test('supervisor can delete issue', async ({ supervisorPage }) => {
    const issueId = await createIssue(supervisorPage.request, 'Delete test');

    const del = await supervisorPage.request.delete(`${BASE}/${issueId}`);
    expect(del.ok()).toBeTruthy();

    const get = await supervisorPage.request.get(`${BASE}/${issueId}`);
    expect(get.status()).toBe(404);
  });

  test('worker cannot delete issue', async ({ supervisorPage, workerPage }) => {
    const issueId = await createIssue(supervisorPage.request, 'Worker delete test');
    createdIssueIds.push(issueId);

    const del = await workerPage.request.delete(`${BASE}/${issueId}`);
    expect(del.status()).toBe(403);
  });
});
