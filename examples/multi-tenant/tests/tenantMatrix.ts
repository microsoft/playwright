// This file centralizes tenant configuration so the specs stay generic.
// The main idea is:
// 1. Read tenant/role data from environment variables.
// 2. Normalize it into one consistent object shape.
// 3. Let every test reuse the same tenant parser instead of hardcoding app data.

export type UserConfig = {
  email: string;
  password: string;
  // Optional role-specific branch. If present, it overrides tenant.branch.
  branch?: string;
  // Optional post-login URL fragment or regex-like string to verify successful sign-in.
  expectedPath?: string;
  // Optional menu labels or navigation labels this role should see after login.
  expectedNavigation?: string[];
};

export type TenantConfig = {
  // Login entry URL for the tenant.
  url: string;
  // Default branch for all roles in the tenant.
  branch?: string;
  // Role map. This mirrors the original Tenants.js structure closely.
  users: Record<string, UserConfig>;
};

function parseCsv(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function toEnvPrefix(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}

function parseNavigation(value: string | undefined): string[] | undefined {
  if (!value)
    return undefined;
  return value
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);
}

function getTenantsFromNamedEnv(): Record<string, TenantConfig> {
  // Named env vars are easiest for teams already using a Tenants.js-like structure.
  // Example:
  // TENANT_NAMES=northwind
  // NORTHWIND_URL=...
  // NORTHWIND_ADMIN_EMAIL=...
  const tenantNames = parseCsv(process.env.TENANT_NAMES);
  if (!tenantNames.length)
    return {};

  const tenants: Record<string, TenantConfig> = {};

  for (const tenantName of tenantNames) {
    const prefix = toEnvPrefix(tenantName);
    const roleNames = parseCsv(process.env[`${prefix}_ROLES`] || 'admin');
    const users: Record<string, UserConfig> = {};

    for (const roleName of roleNames) {
      const rolePrefix = `${prefix}_${toEnvPrefix(roleName)}`;
      const email = process.env[`${rolePrefix}_EMAIL`];
      const password = process.env[`${rolePrefix}_PASSWORD`];

      if (!email || !password)
        continue;

      users[roleName] = {
        email,
        password,
        branch: process.env[`${rolePrefix}_BRANCH`],
        expectedPath: process.env[`${rolePrefix}_EXPECTED_PATH`],
        expectedNavigation: parseNavigation(process.env[`${rolePrefix}_EXPECTED_NAVIGATION`]),
      };
    }

    const url = process.env[`${prefix}_URL`];
    if (!url || !Object.keys(users).length)
      continue;

    tenants[tenantName] = {
      url,
      branch: process.env[`${prefix}_BRANCH`],
      users,
    };
  }

  return tenants;
}

function getTenantsFromJson(): Record<string, TenantConfig> {
  // JSON is still supported for teams that prefer one serialized variable,
  // for example in CI secrets or containerized environments.
  const rawMatrix = process.env.TENANT_MATRIX;
  if (!rawMatrix)
    return {};

  const parsedMatrix = JSON.parse(rawMatrix) as Record<string, {
    baseUrl?: string;
    url?: string;
    branch?: string;
    roles?: Record<string, UserConfig & { branch?: string }>;
    users?: Record<string, UserConfig & { branch?: string }>;
  }>;

  return Object.fromEntries(
    Object.entries(parsedMatrix).map(([tenantName, tenant]) => {
      const users = tenant.users || tenant.roles || {};
      return [tenantName, {
        url: tenant.url || tenant.baseUrl || '',
        branch: tenant.branch,
        users,
      }];
    }).filter(([, tenant]) => tenant.url && Object.keys(tenant.users).length)
  );
}

export function getTenants(): Record<string, TenantConfig> {
  // Prefer the Tenants.js-like named env format when available because it is
  // more readable and easier to document role-by-role.
  const tenantsFromNamedEnv = getTenantsFromNamedEnv();
  if (Object.keys(tenantsFromNamedEnv).length)
    return tenantsFromNamedEnv;

  const tenantsFromJson = getTenantsFromJson();
  if (Object.keys(tenantsFromJson).length)
    return tenantsFromJson;

  throw new Error(
    'No tenant configuration found. Set TENANT_NAMES plus per-tenant env vars, or provide TENANT_MATRIX JSON.'
  );
}

export function getUiConfig() {
  // UI selectors are configurable so the example stays framework-oriented
  // instead of being tied to one specific SaaS product markup.
  return {
    email: process.env.LOGIN_EMAIL_SELECTOR || '#email',
    password: process.env.LOGIN_PASSWORD_SELECTOR || '#password',
    submit: process.env.LOGIN_SUBMIT_SELECTOR || 'button[type="submit"]',
    branchTrigger: process.env.BRANCH_TRIGGER_SELECTOR || '',
    branchOptions: process.env.BRANCH_OPTIONS_SELECTOR || '',
    appReady: process.env.APP_READY_SELECTOR || '',
  };
}
