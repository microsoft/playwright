import { test, expect } from '@playwright/test';
import { signIn } from './auth';
import { getTenants } from './tenantMatrix';

// This spec demonstrates role-based validation after login.
// It is intentionally generic: instead of hardcoding product flows, it checks
// which navigation items each role is allowed to see.
const tenants = getTenants();
const targetTenant = process.env.TARGET_TENANT;
const targetRole = process.env.TARGET_ROLE;

for (const [tenantName, tenant] of Object.entries(tenants)) {
  if (targetTenant && targetTenant !== tenantName)
    continue;

  for (const [roleName, user] of Object.entries(tenant.users)) {
    if (targetRole && targetRole !== roleName)
      continue;
    if (!user.expectedNavigation?.length)
      continue;

    test(`${tenantName} ${roleName} sees expected navigation`, async ({ page }) => {
      // Reuse the same login helper used by other specs so branch and auth
      // behavior stay aligned.
      await signIn(page, tenant, user);

      // Every label in expectedNavigation acts like a lightweight permission check.
      for (const label of user.expectedNavigation!)
        await expect(page.getByText(label, { exact: true })).toBeVisible();
    });
  }
}
