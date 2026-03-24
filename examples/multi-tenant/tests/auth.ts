import { expect, type Page } from '@playwright/test';
import { getUiConfig, type TenantConfig, type UserConfig } from './tenantMatrix';

export async function signIn(page: Page, tenant: TenantConfig, user: UserConfig) {
  // This helper keeps login behavior in one place so every spec can focus on
  // business intent instead of repeating form-filling steps.
  const ui = getUiConfig();
  await page.goto(tenant.url);
  await page.locator(ui.email).fill(user.email);
  await page.locator(ui.password).fill(user.password);

  // Branch resolution order:
  // 1. user.branch  -> role-specific branch
  // 2. tenant.branch -> tenant-wide default branch
  // This lets one tenant route different roles to different branches when needed.
  const branch = user.branch || tenant.branch;
  if (branch && ui.branchTrigger && ui.branchOptions) {
    await page.locator(ui.branchTrigger).click();
    await page.locator(ui.branchOptions).filter({ hasText: branch }).first().click();
  }

  // Once branch selection is done, submit the login form and wait for the app
  // shell to settle before the calling test performs assertions.
  await page.locator(ui.submit).click();
  await page.waitForLoadState('networkidle');

  if (ui.appReady)
    await expect(page.locator(ui.appReady).first()).toBeVisible();
}
