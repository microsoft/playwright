import { Page } from '@playwright/test'
import { BasePage } from './BasePage'
import { amazonPage } from './amazon.page' 

export const createPage = (page: Page) => {
    return {
        base: new BasePage(page),
        amazon: new amazonPage(page)
    }
}
