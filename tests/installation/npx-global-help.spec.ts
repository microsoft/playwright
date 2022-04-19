import { test, expect } from './npmTest';

test('npx playwright --help should not download browsers', async ({ npx }) => {
  const result = await npx('playwright', '--help');
  expect(result.raw.code).toBe(0);
  expect(result).toHaveDownloaded([]);
  expect(result.combined).not.toContain(`To avoid unexpected behavior, please install your dependencies first`);
});
