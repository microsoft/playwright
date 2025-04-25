// tests/page-messages.spec.ts
import { test, expect } from '@playwright/test';
import StreamZip from 'node-stream-zip';

test('should record custom action message in trace', async ({ page, context }, testInfo) => {
 
    await context.tracing.start({ screenshots: false, snapshots: false, sources: false });

  await page.setContent(`<button id="btn">Click me</button>`);

  // Perform action with custom message
  await page.click('#btn', { message: 'Custom click message' });

  // Stop tracing to a file
  const tracePath = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: tracePath });

  // Unzip and read any JSON files in the trace archive
  const zip = new StreamZip.async({ file: tracePath });
  const entries = await zip.entries();
  let combined = '';

  for (const entryName of Object.keys(entries)) {
    if (entryName.endsWith('.json')) {
      const content = await zip.entryData(entryName);
      combined += content.toString();
    }
  }

  await zip.close();

  // Assert custom message shows up in the raw trace data
  expect(combined).toContain('Custom click message');
});
