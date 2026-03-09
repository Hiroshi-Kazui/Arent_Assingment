import { test as base, Page, Browser } from '@playwright/test';

// Fixed: goto に timeout と waitUntil を設定し、hydration 完了を待つ
/** Used only inside issues.spec.ts for multi-role browser contexts */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login', { timeout: 60000, waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/projects') || url.pathname.startsWith('/admin'), {
    timeout: 60000,
  });
}

async function newAuthPage(browser: Browser, storageStatePath: string): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath });
  return context.newPage();
}

type AuthFixtures = {
  supervisorPage: Page;
  adminPage: Page;
  workerPage: Page;
};

export const test = base.extend<AuthFixtures>({
  supervisorPage: async ({ browser }, use) => {
    const page = await newAuthPage(browser, 'e2e/.auth/supervisor.json');
    await use(page);
    await page.context().close();
  },
  adminPage: async ({ browser }, use) => {
    const page = await newAuthPage(browser, 'e2e/.auth/admin.json');
    await use(page);
    await page.context().close();
  },
  workerPage: async ({ browser }, use) => {
    const page = await newAuthPage(browser, 'e2e/.auth/worker.json');
    await use(page);
    await page.context().close();
  },
});

export { expect } from '@playwright/test';
