# Multi-Tenant SaaS Example

This example shows one way to organize Playwright tests for a SaaS application that serves multiple tenants and multiple user roles.

## What It Demonstrates

- A tenant object shaped like `Tenants.js`: each tenant has a `url` and `users`
- Shared authentication helpers
- Reusing test logic across tenants and roles
- Role-specific branch support with tenant-level fallback
- Optional filtering with `TARGET_TENANT` and `TARGET_ROLE`

## How It Works

The example is split into a few small files so each one has one job:

- `tests/tenantMatrix.ts`
  Normalizes tenant data from environment variables into one consistent object shape.
- `tests/auth.ts`
  Performs login using configurable selectors and resolves branch selection.
- `tests/multi-tenant-auth.spec.ts`
  Generates one sign-in test per tenant and role.
- `tests/role-visibility.spec.ts`
  Generates one role-visibility test per tenant and role.

Branch selection works in this order:

1. Role-specific branch: `user.branch`
2. Tenant default branch: `tenant.branch`

That means if a tenant uses one default branch, but a specific role must use another branch, the role-level branch wins.

## Setup

You can configure tenants in two generic ways.

### Option 1: Named environment variables

This is the closest match to your original `Tenants.js` approach.

```bash
export TENANT_NAMES='northwind,fabrikam'
export NORTHWIND_URL='https://northwind.example.com/login'
export NORTHWIND_ROLES='admin,viewer'
export NORTHWIND_ADMIN_EMAIL='admin@northwind.example.com'
export NORTHWIND_ADMIN_PASSWORD='change-me'
export NORTHWIND_ADMIN_BRANCH='HQ'
export NORTHWIND_ADMIN_EXPECTED_PATH='dashboard'
export NORTHWIND_ADMIN_EXPECTED_NAVIGATION='Dashboard|Orders|Settings'
export NORTHWIND_VIEWER_EMAIL='viewer@northwind.example.com'
export NORTHWIND_VIEWER_PASSWORD='change-me'
export NORTHWIND_VIEWER_BRANCH='Outlet'
export NORTHWIND_VIEWER_EXPECTED_PATH='dashboard'
export NORTHWIND_VIEWER_EXPECTED_NAVIGATION='Dashboard|Orders'

export FABRIKAM_URL='https://fabrikam.example.com/login'
export FABRIKAM_BRANCH='Main'
export FABRIKAM_ROLES='admin'
export FABRIKAM_ADMIN_EMAIL='admin@fabrikam.example.com'
export FABRIKAM_ADMIN_PASSWORD='change-me'
```

### Option 2: JSON matrix

`TENANT_MATRIX` is still supported for teams that prefer a single JSON value. Example:

```bash
export TENANT_MATRIX='{"northwind":{"url":"https://northwind.example.com/login","branch":"Main","users":{"admin":{"email":"admin@northwind.example.com","password":"change-me","branch":"HQ","expectedPath":"dashboard","expectedNavigation":["Dashboard","Orders","Settings"]},"viewer":{"email":"viewer@northwind.example.com","password":"change-me","branch":"Outlet","expectedPath":"dashboard","expectedNavigation":["Dashboard","Orders"]}}}}'
export LOGIN_EMAIL_SELECTOR='#email'
export LOGIN_PASSWORD_SELECTOR='#password'
export LOGIN_SUBMIT_SELECTOR='button[type="submit"]'
export APP_READY_SELECTOR='h1'
```

Optional:

```bash
export TARGET_TENANT='northwind'
export TARGET_ROLE='admin'
export BRANCH_TRIGGER_SELECTOR=''
export BRANCH_OPTIONS_SELECTOR=''
```

## Run

```bash
npm install
npx playwright test
```
