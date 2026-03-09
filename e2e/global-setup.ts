import { chromium, FullConfig } from '@playwright/test';
import { SEED } from './fixtures/test-data';

async function saveAuth(email: string, password: string, path: string, baseURL: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseURL}/login`);
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL(
    (url) => url.pathname.startsWith('/projects') || url.pathname.startsWith('/admin'),
    { timeout: 60000 },
  );

  await context.storageState({ path });
  await browser.close();
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:3000';
  await saveAuth(SEED.SUPERVISOR_EMAIL, SEED.PASSWORD, 'e2e/.auth/supervisor.json', baseURL);
  await saveAuth(SEED.ADMIN_EMAIL, SEED.PASSWORD, 'e2e/.auth/admin.json', baseURL);
  await saveAuth(SEED.WORKER_EMAIL, SEED.PASSWORD, 'e2e/.auth/worker.json', baseURL);
}
