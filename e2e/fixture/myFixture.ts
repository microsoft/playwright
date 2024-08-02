import { test as myTest } from '@playwright/test'

type sagar = {
    age: number,
    email: string
}
const myFixtureTest = myTest.extend<sagar>({
    age: 27,
    email:  'sagardurgade@gmail.com'
})

export const test = myFixtureTest;