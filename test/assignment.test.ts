import { test, expect, chromium } from "@playwright/test";
import { createPage } from "./amzon/app"

test("test", async ({ page }) => {
  // test.setTimeout(60000)
  const pages = createPage(page)

  // Nevigare to amazon
  pages.amazon.gotoUrl(testData.url)

  // The dropdown suggestions and validate all are related to searched product
  pages.amazon.searchTextAndVerify(testData.search)

  // Search and select IPhone 13 128 GB
  pages.amazon.searchAndSelect(testData.seatchText)

  // Navigate to next tab and click on Visit the Apple Store
  const pagePromise = page.waitForEvent("popup")
  await page.locator("//*[contains(text(),'Apple iPhone 13')]").first().click()
  const newPage = await pagePromise

  await newPage.locator("//*[contains(text(),'Visit the Apple Store')]").click()
  await newPage.getByRole("button", { name: "Apple Watch" }).click()
  await newPage.getByRole("link", { name: "Apple Watch SE (GPS +" }).click()
  await newPage.getByLabel("Quick look, Starlight Sport").first().click()
  await expect(newPage.getByTestId("product-showcase-title")).toContainText(testData.verifyData)
})

const testData = {
  url: "https://www.amazon.in/",
  search: "iphone 13",
  seatchText: "iphone 13 128GB",
  verifyData: "[GPS + Cellular 40 mm]",
}
