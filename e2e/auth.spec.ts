import { test, expect } from '@playwright/test';
import { SEED } from './fixtures/test-data';

test.describe('Authentication', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
  });

  test('supervisor login succeeds and redirects to /projects', async ({ page }) => {
    test.slow();
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(SEED.SUPERVISOR_EMAIL);
    await page.getByLabel('パスワード').fill(SEED.PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL('**/projects', { timeout: 60000 });
    expect(page.url()).toContain('/projects');
  });

  test('admin login succeeds and can access /admin/organizations', async ({ page }) => {
    test.slow();
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(SEED.ADMIN_EMAIL);
    await page.getByLabel('パスワード').fill(SEED.PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL('**/projects', { timeout: 60000 });
    await page.goto('/admin/organizations');
    await expect(page.getByText('支部一覧')).toBeVisible({ timeout: 15000 });
  });

  test('invalid credentials shows error message', async ({ page }) => {
    test.slow();
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(SEED.SUPERVISOR_EMAIL);
    await page.getByLabel('パスワード').fill('wrongpassword');
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page.getByText('メールアドレスまたはパスワードが正しくありません')).toBeVisible({ timeout: 15000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated access to /projects redirects to /login', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
