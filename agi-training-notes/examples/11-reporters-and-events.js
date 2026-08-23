/**
 * 11-reporters-and-events.js
 *
 * Demonstrates Playwright Test's custom reporter interface (ReporterV2) and event multiplexing.
 *
 * Real source code references studied:
 * - Reporter Interface:
 *   - `packages/playwright/src/reporters/reporterV2.ts` -> `ReporterV2` interface
 *     Defines lifecycle hooks:
 *     - `onConfigure(config)`: called when test config is loaded.
 *     - `onBegin(suite)`: called before test run starts, receives root suite tree.
 *     - `onTestBegin(test, result)`: called when a test starts running.
 *     - `onStepBegin(test, result, step)`: called when a test step starts.
 *     - `onStepEnd(test, result, step)`: called when a test step completes.
 *     - `onTestEnd(test, result)`: called when a test finishes (with status 'passed', 'failed', 'timedOut', 'skipped').
 *     - `onEnd(result)`: called when test run completes.
 * - Event Multiplexer:
 *   - `packages/playwright/src/reporters/multiplexer.ts` -> `Multiplexer` class
 *     Broadcasts runner lifecycle events to all registered built-in (List, Line, Dot, HTML, JSON)
 *     and custom reporters.
 */

// Custom Reporter class implementing ReporterV2 interface
class CustomConsoleReporter {
  version() {
    return 'v2';
  }

  onConfigure(config) {
    console.log(`[Reporter] Test configuration loaded. Timeout: ${config.timeout}ms`);
  }

  onBegin(suite) {
    console.log(`[Reporter] Test run starting. Total tests discovered: ${suite.allTests().length}`);
  }

  onTestBegin(test, result) {
    console.log(`[Reporter] Test started: ${test.title} (Retry #${result.retry})`);
  }

  onTestEnd(test, result) {
    console.log(`[Reporter] Test completed: ${test.title} | Status: ${result.status} | Duration: ${result.duration}ms`);
  }

  async onEnd(result) {
    console.log(`[Reporter] Test run finished. Overall status: ${result.status}`);
  }
}

console.log('Custom Reporter class implementing ReporterV2 interface defined.');
console.log('Multiplexer in reporters/multiplexer.ts broadcasts all events to configured reporters.');
