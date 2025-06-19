import { browserTest as test } from '../config/browserTest';
import { expect } from '@playwright/test';

test('should prevent path traversal when creating temp files', async ({ browser }) => {
  const context = await browser.newContext();

  // Test path traversal protection by attempting to upload files with malicious paths
  // This will internally call the createTempFiles method in BrowserContextDispatcher
  const maliciousFiles = [
    {
      name: '../../etc/passwd',
      mimeType: 'text/plain',
      buffer: Buffer.from('malicious content 1')
    },
    {
      name: '../../../tmp/malicious.txt', 
      mimeType: 'text/plain',
      buffer: Buffer.from('malicious content 2')
    },
    {
      name: '..\\..\\windows\\system32\\config\\sam',
      mimeType: 'text/plain', 
      buffer: Buffer.from('malicious content 3')
    },
    {
      name: '/etc/passwd',
      mimeType: 'text/plain',
      buffer: Buffer.from('absolute path attempt')
    }
  ];

  const page = await context.newPage();
  await page.setContent('<input type="file" multiple>');
  const input = await page.locator('input[type="file"]');

  // Each of these should be rejected due to path traversal protection
  for (const maliciousFile of maliciousFiles) {
    await expect(async () => {
      await input.setInputFiles([maliciousFile]);
    }).rejects.toThrow(/Invalid file path/);
  }

  // Test that valid files still work
  const validFile = {
    name: 'valid-file.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('valid content')
  };

  // This should not throw an error
  await input.setInputFiles([validFile]);

  await context.close();
});

test('should prevent backslash path traversal attempts', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.setContent('<input type="file" multiple>');
  const input = await page.locator('input[type="file"]');

  // Test Windows-style backslash path traversal attempts
  const backslashFiles = [
    {
      name: '..\\config\\secrets.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('backslash traversal')
    },
    {
      name: 'folder\\..\\..\\system.ini',
      mimeType: 'text/plain',
      buffer: Buffer.from('nested backslash traversal')
    }
  ];

  for (const file of backslashFiles) {
    await expect(async () => {
      await input.setInputFiles([file]);
    }).rejects.toThrow(/Invalid file path/);
  }

  await context.close();
});
