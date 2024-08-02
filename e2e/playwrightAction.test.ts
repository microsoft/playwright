import { test, } from '@playwright/test'
test.describe('Playwright action ', () => {
    test('Right click Test Case', async ({page}) => {
        await page.goto('https://www.tutorialspoint.com/')
      
        // await page.locator("//a[text()='Login']").click( { button: "right" })
        // await page.getByRole('button', { name: 'Login' }).click( { button: "right" })
        // await page.locator().click( option: 'right')
        await page.waitForTimeout(5000)
    })
})