import { BasePage, expect } from "./BasePage"

export class amazonPage extends BasePage {

  async gotoUrl(userName: string) {
    await this.page.goto(userName)
    await this.page.waitForLoadState()
  }

  async searchTextAndVerify(search:string)
  {
    await this.page.getByLabel('Select the department you').selectOption('search-alias=electronics')
    await this.page.getByPlaceholder('Search Amazon.in').fill(search)
    const rows = this.page.locator("[class='left-pane-results-container'] [role='button']")
    const count = await rows.count()
    for (let i = 0; i < count; ++i)
      await expect(rows.nth(i)).toContainText(search)
    await this.page.getByPlaceholder('Search Amazon.in').clear()
  }
  async searchAndSelect(searchText:string) {
    await this.page.waitForTimeout(2000)
    await this.page.getByPlaceholder("Search Amazon.in").fill(searchText)
    await this.page.getByLabel(searchText).first().click()
  }
  
}

