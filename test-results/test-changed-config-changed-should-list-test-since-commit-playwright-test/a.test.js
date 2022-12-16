
    const pwt = require('@playwright/test');
  const { expect } = pwt;

    const { test } = pwt;
    test('should work 1', async ({}, testInfo) => {
      console.log('Running test 1');
    });
  