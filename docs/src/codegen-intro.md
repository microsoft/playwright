---
id: codegen-intro
title: "Test Generator"
---

Playwright comes with the ability to generate tests out of the box and is a great way to quickly get started with testing. It will open two windows, a browser window where you interact with the website you wish to test and the Playwright Inspector window where you can record your tests, copy the tests, clear your tests as well as change the language of your tests.

**You will learn**

- [How to generate tests with Codegen](/codegen.md#running-codegen)


## Running Codegen

```bash js
npx playwright codegen playwright.dev
```

```bash java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen playwright.dev"
```

```bash python
playwright codegen playwright.dev
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen playwright.dev
```

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will attempt to generate resilient text-based selectors.

<img width="1183" alt="Codegen generating code for tests for playwright.dev website" src="https://user-images.githubusercontent.com/13063165/181852815-971c10da-0b55-4e54-8a73-77e1e825193c.png" />

When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor. 

<img width="1266" alt="Codegen generating code for tests for playwright.dev" src="https://user-images.githubusercontent.com/13063165/183905981-003c4173-0d5e-4960-8190-50e6ca71b2c3.png" />


Use the **clear** button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.



To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).


## What's Next

- [See a trace of your tests](./trace-viewer.md)
