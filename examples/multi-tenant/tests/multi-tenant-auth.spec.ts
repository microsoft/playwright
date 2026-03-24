import { test, expect } from '@playwright/test';
import { signIn } from './auth';
import { getTenants, getUiConfig } from './tenantMatrix';

// Build tests from configuration instead of writing one file per tenant/role.
// This is the core multi-tenant idea: one reusable test definition, many tenants.
const tenants = getTenants();
const ui = getUiConfig();
const targetTenant = process.env.TARGET_TENANT;
const targetRole = process.env.TARGET_ROLE;

for (const [tenantName, tenant] of Object.entries(tenants)) {
  if (targetTenant && targetTenant !== tenantName)
    continue;

  for (const [roleName, user] of Object.entries(tenant.users)) {
    if (targetRole && targetRole !== roleName)
      continue;

    test(`${tenantName} ${roleName} can sign in`, async ({ page }) => {
      // Use the shared auth helper so login behavior stays consistent across all tests.
      await signIn(page, tenant, user);

      // Optional URL assertion. Teams can use this to prove the user landed in the
      // correct area after sign-in.
      if (user.expectedPath)
        await expect(page).toHaveURL(new RegExp(user.expectedPath));

      // Optional "app is ready" assertion using a configurable selector.
      if (ui.appReady)
        await expect(page.locator(ui.appReady).first()).toBeVisible();
    });
  }
}
