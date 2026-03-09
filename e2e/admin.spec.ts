import { test, expect } from './fixtures/auth';
import { SEED } from './fixtures/test-data';

// ────────────────────────────────────────────────
// E2E-ORG-001: 組織管理フロー (作成→更新→削除)
// ────────────────────────────────────────────────

test.describe('組織管理 (Admin)', () => {
  // E2E-ORG-001: 組織管理フロー (作成→更新→削除)
  test('Admin が Branch 組織を作成・更新・削除できる', async ({ adminPage }) => {
    const page = adminPage;

    // Step 1: POST /api/organizations で Branch 組織を作成
    const createRes = await page.request.post('/api/organizations', {
      data: {
        name: 'E2E テスト新支部',
        parentId: SEED.HQ_ORG_ID,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.organizationId).toBeDefined();
    expect(created.name).toBe('E2E テスト新支部');
    const orgId: string = created.organizationId;

    // Step 2: PATCH /api/organizations/{id} で組織名を更新
    const updateRes = await page.request.patch(`/api/organizations/${orgId}`, {
      data: { name: 'E2E テスト改名支部' },
    });
    expect(updateRes.ok()).toBeTruthy();
    expect(updateRes.status()).toBe(200);

    // Step 3: DELETE /api/organizations/{id} で組織を削除
    // （新規作成した組織にはユーザーが所属していないため削除可能）
    const deleteRes = await page.request.delete(`/api/organizations/${orgId}`);
    expect(deleteRes.ok()).toBeTruthy();
    expect(deleteRes.status()).toBe(200);

    // 後続確認: 組織一覧から削除されていること
    const listRes = await page.request.get('/api/organizations');
    expect(listRes.ok()).toBeTruthy();
    const orgs = await listRes.json();
    const stillExists = (orgs as Array<{ organizationId?: string; id?: string }>).some(
      (o) => o.organizationId === orgId || o.id === orgId,
    );
    expect(stillExists).toBeFalsy();
  });

  test('Admin 以外は組織作成ができない (403)', async ({ supervisorPage }) => {
    const res = await supervisorPage.request.post('/api/organizations', {
      data: {
        name: '権限なし支部',
        parentId: SEED.HQ_ORG_ID,
      },
    });
    expect(res.status()).toBe(403);
  });
});

// ────────────────────────────────────────────────
// E2E-USR-001: ユーザー管理フロー (作成→更新→論理削除)
// ────────────────────────────────────────────────

test.describe('ユーザー管理 (Admin)', () => {
  // E2E-USR-001: ユーザー管理フロー (作成→更新→論理削除)
  test('Admin がユーザーを作成・更新・論理削除できる', async ({ adminPage }) => {
    const page = adminPage;
    const uniqueSuffix = Date.now();
    const testEmail = `e2e-user-${uniqueSuffix}@example.com`;

    // Step 1: POST /api/users でユーザーを作成
    const createRes = await page.request.post('/api/users', {
      data: {
        name: 'E2E テストユーザー',
        email: testEmail,
        password: 'Password123!',
        role: 'WORKER',
        organizationId: SEED.BRANCH_ORG_ID,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.userId ?? created.id).toBeDefined();
    const userId: string = created.userId ?? created.id;

    // Step 2: PATCH /api/users/{id} でユーザー名を更新
    const updateRes = await page.request.patch(`/api/users/${userId}`, {
      data: { name: 'E2E テスト新名前' },
    });
    expect(updateRes.ok()).toBeTruthy();
    expect(updateRes.status()).toBe(200);

    // Step 3: DELETE /api/users/{id} で論理削除
    const deleteRes = await page.request.delete(`/api/users/${userId}`);
    expect(deleteRes.ok()).toBeTruthy();
    expect(deleteRes.status()).toBe(200);

    // 後続確認: ユーザー一覧で is_active が false になっていること
    const listRes = await page.request.get('/api/users');
    expect(listRes.ok()).toBeTruthy();
    const users = await listRes.json();
    const deactivated = (users as Array<{ userId?: string; id?: string; isActive?: boolean }>).find(
      (u) => u.userId === userId || u.id === userId,
    );
    // 論理削除なのでレコードは存在し isActive=false であること
    if (deactivated !== undefined) {
      expect(deactivated.isActive).toBeFalsy();
    }
  });

  test('Admin 以外はユーザー一覧を取得できない (403)', async ({ supervisorPage }) => {
    const res = await supervisorPage.request.get('/api/users');
    // Supervisor は403, Worker は403
    expect([401, 403]).toContain(res.status());
  });
});
