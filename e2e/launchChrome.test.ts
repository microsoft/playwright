import { Browser, chromium, test } from '@playwright/test'
test('Launch chrome', async() => {
    const browser = await chromium.launch({ headless: false })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('https://www.google.com/')
    await page.screenshot({ path: './e2e/example-.png' })
})



test('titel', async () => {
    const browser = await chromium.launch({})
    const page = await browser.newPage()
    await page.goto('https://www.google.com/')
    
})  