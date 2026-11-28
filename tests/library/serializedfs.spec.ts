import { baseTest as test } from '../config/baseTest';
import { expect } from '@playwright/test';
import { SerializedFS } from '../../packages/utils/serializedFS';

test('skipIfExists should propagate filesystem errors other than EEXIST', async ({}, testInfo) => {
  const serializedFS = new SerializedFS();
  serializedFS.writeFile(testInfo.outputPath('missing-dir/file.txt'), 'content', true);
  await expect(serializedFS.sync()).rejects.toMatchObject({ code: 'ENOENT' });
});

test('skipIfExists should ignore EEXIST', async ({}, testInfo) => {
  const fs = await import('fs/promises');
  const file = testInfo.outputPath('existing.txt');
  await fs.writeFile(file, 'original');

  const serializedFS = new SerializedFS();
  serializedFS.writeFile(file, 'replacement', true);
  await serializedFS.sync();

  expect(await fs.readFile(file, 'utf8')).toBe('original');
});
