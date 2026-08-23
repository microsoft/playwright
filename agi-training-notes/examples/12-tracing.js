/**
 * 12-tracing.js
 *
 * Demonstrates Playwright Tracing API (context.tracing.start/stop), trace archive generation,
 * and how the Trace Viewer reconstructs test execution timelines.
 *
 * Real source code references studied:
 * - Client API Entry Point:
 *   - `packages/playwright-core/src/client/tracing.ts` -> `Tracing` class
 *     Methods: `start()`, `startChunk()`, `stopChunk()`, `stop({ path })`.
 *     Sends RPC channel commands `tracingStart`, `tracingStartChunk`, `tracingStop` over `_channel`.
 * - Server Trace Recorder Engine:
 *   - `packages/playwright-core/src/server/trace/recorder/tracing.ts` -> `Tracing` class
 *     Coordinates `Snapshotter` (`server/trace/recorder/snapshotter.ts`) for DOM snapshots,
 *     `HarTracer` for network events, and screencast frame recorders.
 * - Trace Archive Structure (.zip):
 *   - `trace.trace`: JSON lines format containing API calls, parameters, durations, console logs, stack frames.
 *   - `trace.network`: JSON lines format containing HAR network request/response headers, timings, and status codes.
 *   - `resources/`: Content-addressed directory (keyed by SHA1) storing response bodies, DOM snapshots, images, fonts.
 *   - `trace.stacks`: Source code stack traces and location mappings.
 * - Trace Viewer Architecture:
 *   - `packages/playwright-core/src/server/trace/viewer/traceViewer.ts` -> `startTraceViewerServer()`
 *     Spawns an `HttpServer` serving the Vite web application from `packages/trace-viewer/`.
 *     Serves trace files and resources via `/file?path=...` endpoints to the React frontend (`packages/trace-viewer/src/ui/workbench.tsx`).
 */

const { chromium } = require('playwright-core');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Start tracing on the browser context.
  // Tracing in client/tracing.ts sends tracingStart RPC to server/trace/recorder/tracing.ts.
  await context.tracing.start({
    name: 'user_flow_trace',
    title: 'User Login & Checkout Flow',
    screenshots: true, // captures screencast images for visual timeline
    snapshots: true,   // captures DOM snapshots before & after each action for time-travel inspection
    sources: true      // captures source code stack frames
  });

  const page = await context.newPage();

  // Actions executed here are logged to trace.trace by Tracing.onBeforeCall / onAfterCall
  await page.goto('https://example.com');
  const link = page.locator('a');
  await link.click();

  // Stop tracing and save archive to disk.
  // Tracing.stop() in client/tracing.ts stops recording and streams the zip archive containing
  // trace.trace, trace.network, and resources/ to the specified path.
  const tracePath = path.join(__dirname, 'scratch', 'trace.zip');
  await context.tracing.stop({ path: tracePath });

  console.log(`Trace archive successfully recorded and saved to: ${tracePath}`);
  console.log('To view the recorded trace, run:');
  console.log(`npx playwright show-trace ${tracePath}`);

  await context.close();
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
