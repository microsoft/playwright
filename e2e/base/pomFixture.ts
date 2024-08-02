import { test as baseTest } from "@playwright/test"

type pages = {
    registerPage: RegisterPage ,

}
baseTest.extend()