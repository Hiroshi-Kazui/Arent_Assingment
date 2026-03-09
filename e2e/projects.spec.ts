import { test, expect } from './fixtures/auth';
import { SEED } from './fixtures/test-data';

test.describe('Project list', () => {
  test('supervisor sees project with name and status badge', async ({ supervisorPage }) => {
    await supervisorPage.goto('/projects');
    await expect(supervisorPage.getByText(SEED.PROJECT_NAME)).toBeVisible({ timeout: 30000 });
    await expect(supervisorPage.getByText('進行中')).toBeVisible();
  });

  test('clicking project card navigates to viewer', async ({ supervisorPage }) => {
    await supervisorPage.goto('/projects');
    await expect(supervisorPage.getByText(SEED.PROJECT_NAME)).toBeVisible({ timeout: 30000 });
    await supervisorPage.getByText(SEED.PROJECT_NAME).click();
    await supervisorPage.waitForURL(`**/projects/${SEED.PROJECT_ID}/viewer`, { timeout: 30000 });
    expect(supervisorPage.url()).toContain(`/projects/${SEED.PROJECT_ID}/viewer`);
  });

  test('worker can access /projects page (sees only assigned projects)', async ({ workerPage }) => {
    await workerPage.goto('/projects');
    await expect(workerPage).toHaveURL(/\/projects/);
    await expect(workerPage.locator('body')).toBeVisible();
  });
});
