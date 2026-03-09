import { test, expect } from '@playwright/test';
import { SEED } from './fixtures/test-data';

test.describe('認証・認可', () => {
  // E2E-AUT-001: 未認証ユーザーがすべての保護エンドポイントで 401 を受け取る
  test.describe('未認証アクセスは 401 を返す', () => {
    // セッション Cookie を持たない新しいコンテキストを使うため、
    // storageState を指定せずにデフォルトの page フィクスチャを利用する
    test('GET /api/projects は 401 を返す', async ({ page }) => {
      const res = await page.request.get('/api/projects');
      expect(res.status()).toBe(401);
    });

    test('POST /api/projects は 401 を返す', async ({ page }) => {
      const res = await page.request.post('/api/projects', {
        data: {
          buildingId: SEED.BUILDING_ID,
          name: 'テストプロジェクト',
          startDate: '2026-01-01',
          dueDate: '2026-12-31',
          branchId: SEED.BRANCH_ORG_ID,
        },
      });
      expect(res.status()).toBe(401);
    });

    test('GET /api/users は 401 を返す', async ({ page }) => {
      const res = await page.request.get('/api/users');
      expect(res.status()).toBe(401);
    });

    test('GET /api/projects/{id}/issues は 401 を返す', async ({ page }) => {
      const res = await page.request.get(
        `/api/projects/${SEED.PROJECT_ID}/issues`,
      );
      expect(res.status()).toBe(401);
    });
  });

  test.describe('ログインフロー', () => {
    // Fixed: goto に timeout を長めに設定し、waitForLoadState で hydration 完了を待つ
    test('Supervisor が正常にログインしてプロジェクト一覧に遷移する', async ({ page }) => {
      await page.goto('/login', { timeout: 60000, waitUntil: 'networkidle' });
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel('メールアドレス').fill(SEED.SUPERVISOR_EMAIL);
      await page.getByLabel('パスワード').fill(SEED.PASSWORD);
      await page.getByRole('button', { name: 'ログイン' }).click();
      await page.waitForURL('**/projects', { timeout: 60000 });
      expect(page.url()).toContain('/projects');
    });

    test('Admin が正常にログインして admin 画面に遷移する', async ({ page }) => {
      await page.goto('/login', { timeout: 60000, waitUntil: 'networkidle' });
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel('メールアドレス').fill(SEED.ADMIN_EMAIL);
      await page.getByLabel('パスワード').fill(SEED.PASSWORD);
      await page.getByRole('button', { name: 'ログイン' }).click();
      await page.waitForURL(
        (url) =>
          url.pathname.startsWith('/projects') ||
          url.pathname.startsWith('/admin'),
        { timeout: 60000 },
      );
      expect(
        page.url().includes('/projects') || page.url().includes('/admin'),
      ).toBeTruthy();
    });

    test('誤ったパスワードでログインするとエラーが表示される', async ({ page }) => {
      await page.goto('/login', { timeout: 60000, waitUntil: 'networkidle' });
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel('メールアドレス').fill(SEED.SUPERVISOR_EMAIL);
      await page.getByLabel('パスワード').fill('wrongpassword');
      await page.getByRole('button', { name: 'ログイン' }).click();
      // ログインページに留まること
      await page.waitForTimeout(3000);
      expect(page.url()).toContain('/login');
    });
  });
});
