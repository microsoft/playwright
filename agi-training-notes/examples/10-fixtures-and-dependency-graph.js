/**
 * 10-fixtures-and-dependency-graph.js
 *
 * Demonstrates Playwright Test's dependency-injection fixture system (test.extend),
 * fixture scoping (test vs worker), and DAG resolution order.
 *
 * Real source code references studied:
 * - Fixture Registration & Pool:
 *   - `packages/playwright/src/common/fixtures.ts` -> `FixturePool` class, `FixtureRegistration` type
 *     Parses fixture function parameters (e.g. `({ db, page }, use) => ...` -> `deps: ['db', 'page']`).
 *     Manages fixture overrides (`test.use()`) and validates scoping rules.
 * - Fixture Execution & Lifecycle:
 *   - `packages/playwright/src/worker/fixtureRunner.ts` -> `FixtureRunner` & `Fixture` classes
 *     Resolves dependency DAG in topological order:
 *     1. Setup: leaf dependencies first -> downstream dependencies -> test body.
 *     2. Fixture pauses at `await use(value)`.
 *     3. Teardown: test body completes -> root fixtures teardown -> leaf fixtures teardown.
 * - Fixture Scoping:
 *   - `scope: 'worker'`: Instantiated once per worker process, shared across tests in that worker.
 *   - `scope: 'test'` (default): Instantiated fresh before each test and torn down immediately after.
 */

// Simulated fixture definitions demonstrating dependency resolution
const customFixtures = {
  // Worker-scoped fixture (created once per worker process)
  dbConnection: [async ({}, use) => {
    console.log('[Worker Setup] Initializing database connection...');
    const db = { query: (sql) => `Results for ${sql}` };
    await use(db);
    console.log('[Worker Teardown] Closing database connection.');
  }, { scope: 'worker' }],

  // Test-scoped fixture depending on dbConnection worker fixture
  authenticatedUser: async ({ dbConnection }, use) => {
    console.log('[Test Setup] Creating temporary test user in DB...');
    const user = { id: 101, username: 'test_user', db: dbConnection };
    await use(user);
    console.log('[Test Teardown] Cleaning up temporary test user.');
  }
};

console.log('Fixture definitions structure prepared.');
console.log('In Playwright Test, FixturePool (common/fixtures.ts) constructs the dependency graph,');
console.log('and FixtureRunner (worker/fixtureRunner.ts) executes setup/teardown in topological order.');
