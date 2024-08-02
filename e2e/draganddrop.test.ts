import{ expect, test }from '@playwright/test'

test.describe('Drag and Drop', () => {
    test('[3003]Verify the darg and drop', async ({page}) => {

        await page.goto('https://commitquality.com/practice')
        const sd = page.locator("[data-testid='practice-drag-drop']")
        await sd.scrollIntoViewIfNeeded()
        await sd.click()
        await page.locator("#small-box").dragTo(page.locator(".large-box "))
        await expect(page.locator("//div[text()='Success!']")).toBeVisible()
        
        let r = (Math.random() + 1).toString(36).substring(7)
        console.log("random", r);
        let randomString = "e2e/0" + r + ".png"
        await page.screenshot({path: randomString})
    });
    test('[2210] Verify the drage and drop by using mouse hour', async ({page}) => {
        await page.goto('https://commitquality.com/practice')
        const sd = page.locator("[data-testid='practice-drag-drop']")
        await sd.scrollIntoViewIfNeeded()
        await sd.click()
        await page.locator("#small-box").hover()
        await page.mouse.down()
        await page.locator(".large-box ").hover()
        await page.mouse.up()
        await expect(page.locator("//div[text()='Success!']")).toBeVisible()
        // await page.waitForTimeout(5000);
    });
})