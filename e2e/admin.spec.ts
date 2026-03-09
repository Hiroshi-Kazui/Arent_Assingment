import { test, expect } from './fixtures/auth';
import { SEED } from './fixtures/test-data';

test.describe('Admin - Organizations', () => {
  test('admin sees organizations list with seed orgs', async ({ adminPage }) => {
    await adminPage.goto('/admin/organizations');
    await expect(adminPage.getByText('支部一覧')).toBeVisible();
    await expect(adminPage.getByText('本社')).toBeVisible();
  });

  test('admin can add a branch', async ({ adminPage }) => {
    await adminPage.goto('/admin/organizations');
    await adminPage.getByRole('button', { name: '支部追加' }).click();
    const dialog = adminPage.locator('[role="dialog"]');
    await dialog.getByRole('textbox').fill('E2Eテスト支部');
    await dialog.getByRole('button', { name: '追加' }).click();
    await expect(adminPage.getByText('E2Eテスト支部')).toBeVisible();

    // Cleanup via API
    const res = await adminPage.request.get('/api/organizations');
    const body = await res.json();
    const org = body.find((o: any) => o.name === 'E2Eテスト支部');
    if (org) {
      await adminPage.request.delete(`/api/organizations/${org.organizationId}`);
    }
  });

  test('admin can edit a branch name', async ({ adminPage }) => {
    // Create via API first
    const createRes = await adminPage.request.post('/api/organizations', {
      data: { name: '編集テスト支部', parentId: SEED.HQ_ORG_ID },
    });
    const created = await createRes.json();
    const orgId = created.organizationId;

    await adminPage.goto('/admin/organizations');
    // Use .first() to handle leftover rows from previous failed runs
    const row = adminPage.locator('tr').filter({ hasText: '編集テスト支部' }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.getByRole('button', { name: '編集' }).click();
    const dialog = adminPage.locator('[role="dialog"]');
    const input = dialog.getByRole('textbox');
    await input.clear();
    await input.fill('編集済み支部');
    await dialog.getByRole('button', { name: '更新' }).click();
    await expect(adminPage.getByText('編集済み支部')).toBeVisible();

    // Cleanup
    await adminPage.request.delete(`/api/organizations/${orgId}`);
  });

  test('admin can delete a branch', async ({ adminPage }) => {
    // Create via API first
    const createRes = await adminPage.request.post('/api/organizations', {
      data: { name: '削除テスト支部', parentId: SEED.HQ_ORG_ID },
    });
    const created = await createRes.json();
    const orgId = created.organizationId;

    await adminPage.goto('/admin/organizations');
    // Use .first() to handle leftover rows from previous failed runs
    const row = adminPage.locator('tr').filter({ hasText: '削除テスト支部' }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.getByRole('button', { name: '削除' }).click();
    const dialog = adminPage.locator('[role="dialog"]');
    await dialog.getByRole('button', { name: '削除' }).click();
    await expect(adminPage.getByRole('link', { name: '削除テスト支部' }).first()).not.toBeVisible({ timeout: 5000 });

    // Cleanup fallback (in case UI delete failed)
    await adminPage.request.delete(`/api/organizations/${orgId}`).catch(() => {});
  });

  test('non-admin (supervisor) cannot access admin page', async ({ supervisorPage }) => {
    await supervisorPage.goto('/admin/organizations');
    await supervisorPage.waitForURL('**/projects', { timeout: 10000 });
    expect(supervisorPage.url()).toContain('/projects');
  });
});

test.describe('Admin - Users', () => {
  test('admin sees users list with seed users', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await expect(adminPage.getByRole('cell', { name: '管理者太郎' })).toBeVisible({ timeout: 30000 });
    await expect(adminPage.getByRole('cell', { name: '監督次郎' })).toBeVisible();
    await expect(adminPage.getByRole('cell', { name: '作業員三郎' })).toBeVisible();
  });

  test('admin can add a user', async ({ adminPage }) => {
    const testEmail = `e2e.test.${Date.now()}@example.com`;
    await adminPage.goto('/admin/users');
    await expect(adminPage.getByRole('button', { name: 'ユーザー追加' })).toBeVisible({ timeout: 30000 });
    await adminPage.getByRole('button', { name: 'ユーザー追加' }).click();
    const dialog = adminPage.locator('[role="dialog"]');
    await dialog.getByPlaceholder('名前を入力').fill('E2Eテストユーザー');
    await dialog.getByPlaceholder('email@example.com').fill(testEmail);
    await dialog.getByPlaceholder('パスワードを入力').fill('password123');
    await dialog.locator('select').nth(0).selectOption('WORKER');
    await dialog.locator('select').nth(1).selectOption({ index: 1 });
    await dialog.getByRole('button', { name: '追加' }).click();
    await expect(adminPage.locator('td').filter({ hasText: 'E2Eテストユーザー' }).first()).toBeVisible();

    // Cleanup via API
    const res = await adminPage.request.get('/api/users');
    const body = await res.json();
    const user = Array.isArray(body)
      ? body.find((u: any) => u.email === testEmail)
      : body.items?.find((u: any) => u.email === testEmail);
    if (user) {
      await adminPage.request.delete(`/api/users/${user.userId}`);
    }
  });
});
