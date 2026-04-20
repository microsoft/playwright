#!/usr/bin/env node

const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('data:text/html,<title>Rocky Linux 9</title><h1>Playwright on Rocky Linux 9</h1>');
  const title = await page.title();
  if (title !== 'Rocky Linux 9')
    throw new Error(`Unexpected title: ${title}`);
  console.log('title:', title);
  await browser.close();
  console.log('Chromium smoke test PASSED');
})().catch(e => { console.error(e); process.exit(1); });
