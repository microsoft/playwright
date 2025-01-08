import { execSync } from 'child_process';
import { expect, test } from '@playwright/test';

test('playwright ls command should list installed browsers', async () => {
  const result = execSync('npx playwright ls').toString();
  expect(result).toContain('Browser:');
  expect(result).toContain('Version:');
  expect(result).toContain('Install location:');
});
