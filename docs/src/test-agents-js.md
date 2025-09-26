---
id: test-agents
title: "Agents"
---

# Playwright Agents

## Test Coverage in 1-2-3

Playwright’s agentic workflow makes it possible to generate test coverage in three straightforward steps.
These steps can be performed independently, manually, or as chained calls in an agentic loop.

1. **Plan**: A planning agent explores the app and produces a test plan in `specs/*.md`.

2. **Generate**: A generating agent transforms the plan into `tests/*.spec.ts` files. It executes actions against your site to verify selectors and flows, then emits testing code and assertions.

3. **Heal**: A healing agent executes the test suite and automatically repairs failing tests by applying diffs in place.

### Getting Started

In order to use Playwright Agents, you must add their definitions to your project using
the `init-agents` command. These definitions should be regenerated whenever Playwright
is updated.

You need to run this command for each agentic loop you will be using:

```bash
# Generate agent files for each agentic loop
# Visual Studio Code
npx playwright init-agents --loop=code
# Claude Code
npx playwright init-agents --loop=claude
# opencode
npx playwright init-agents --loop=opencode
```

Once the agents have been generated, you can use your AI tool of choice to command these agents to build Playwright Tests. Playwright splits this into three steps with one agent per step:

## 1. Plan

The planning agent explores your app environment and produces a test plan for one or many scenarios and user flows.

**Input**

* A clear request to the planning agent (e.g., “Generate a plan for guest checkout.”)
* A live app entry point (URL) or a seed Playwright test that sets up the environment necessary to talk to your app
* A Product Requirement Document (PRD) (optional)

**Example Prompt**

```markdown
<agent:planner> Generate a test plan for "Guest Checkout" scenario.
                Use `seed.spec.ts` as a seed test for the plan.
```

**Output**

* A Markdown test plan saved to `specs/[scenario name].md`. The plan is human-readable but precise enough for test generation.

<details>
<summary>Example: specs/guest-checkout.md</summary>

```markdown
# Feature: Guest Checkout

## Purpose
Allow a user to purchase without creating an account.

## Preconditions
- Test seed `tests/seed.spec.ts`.
- Payment sandbox credentials available via env vars.

## Scenarios

### SC-1: Add single item to cart and purchase
**Steps**
1. Open home page.
2. Search for "Wireless Mouse".
3. Open product page and add to cart.
4. Proceed to checkout as guest.
5. Fill shipping and payment details.
6. Confirm order.

**Expected**
- Cart count increments after item is added.
- Checkout page shows item, price, tax, and total.
- Order confirmation number appears; status is "Processing".

### SC-2: Tax and shipping recalculation on address change
**Steps**
1. Start checkout with a CA address.
2. Change state to NY.

**Expected**
- Tax and shipping values recalculate.

## Data
- Product SKU: `WM-123`
- Payment: sandbox card `4111 1111 1111 1111`, valid expiry, CVV `123`.

## Methodology
*Optional notes about testing methodology*
```
</details>

## 2. Generate

The generating agent uses the Markdown plan to produce executable Playwright tests.
It verifies selectors and assertions live against the application. Playwright supports
generation hints and provides a catalog of assertions for efficient structural and
behavioral validation.

**Input**

* Markdown plan from `specs/`

**Example Prompt**

```markdown
<agent:generator> Generate tests for the guest checkout plan under `specs/`.
```

**Output**

* A test suite under `tests/`
* Generated tests may include initial errors that can be healed automatically by the healer agent

<details>
<summary>Example: tests/guest-checkout.spec.ts</summary>

```ts
import { test, expect } from '@playwright/test';

test.describe('Guest Checkout', () => {
  test('SC-1: add item and purchase', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: /search/i }).fill('Wireless Mouse');
    await page.getByRole('button', { name: /search/i }).click();

    await page.getByRole('link', { name: /wireless mouse/i }).click();
    await page.getByRole('button', { name: /add to cart/i }).click();

    // Assertion: cart badge increments
    await expect(page.getByTestId('cart-badge')).toHaveText('1');

    await page.getByRole('link', { name: /checkout/i }).click();
    await page.getByRole('button', { name: /continue as guest/i }).click();

    // Fill checkout form
    await page.getByLabel('Email').fill(process.env.CHECKOUT_EMAIL!);
    await page.getByLabel('Full name').fill('Alex Guest');
    await page.getByLabel('Address').fill('1 Market St');
    await page.getByLabel('City').fill('San Francisco');
    await page.getByLabel('State').selectOption('CA');
    await page.getByLabel('ZIP').fill('94105');

    // Payment (sandbox)
    const frame = page.frameLocator('[data-testid="card-iframe"]');
    await frame.getByLabel('Card number').fill('4111111111111111');
    await frame.getByLabel('MM / YY').fill('12/30');
    await frame.getByLabel('CVC').fill('123');

    await page.getByRole('button', { name: /pay/i }).click();

    // Assertions: confirmation invariants
    await expect(page).toHaveURL(/\/orders\/\w+\/confirmation/);
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible();
    await expect(page.getByTestId('order-status')).toHaveText(/processing/i);

    // Optional visual check
    await expect(page.locator('[data-testid="order-summary"]')).toHaveScreenshot();
  });
});
```
</details>

## 3. Heal

When a test fails, the healing agent:

* Replays the failing steps
* Inspects the current UI to locate equivalent elements or flows
* Suggests a patch (e.g., locator update, wait adjustment, data fix)
* Re-runs the test until it passes or until guardrails stop the loop

**Input**

* Failing test name

**Example Prompt**

```markdown
<agent:healer> Fix all failing tests for the guest checkout scenario.
```

**Output**

* A passing test, or a skipped test if the healer was unable to ensure correct functionality

## Artifacts and Conventions

The static agent definitions and generated files follow a simple, auditable structure:

```bash
repo/
  .{claude|copilot|vscode|...}/ # agent definitions, tools, guardrails
  specs/                        # human-readable test plans
    checkout-guest.md
    account-settings.md
  tests/                        # generated Playwright tests
    seed.spec.ts
    checkout-guest.spec.ts
    account-settings.spec.ts
  playwright.config.ts
```

### Agent Definitions

Agent definitions are collections of instructions and MCP tools. They are provided by
Playwright and should be regenerated whenever Playwright is updated.

Example for Claude Code subagents:

```bash
npx playwright init-agents --loop=claude
```

### Specs in `specs/`

Specs are structured plans describing scenarios in human-readable terms. They include
steps, expected outcomes, and data. Specs can start from scratch or extend a seed test.

### Tests in `tests/`

Generated Playwright tests, aligned one-to-one with specs wherever feasible.

### Seed tests `seed.spec.ts`

Seed tests provide a ready-to-use `page` context to bootstrap execution.
