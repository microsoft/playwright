---
id: codegen-intro
title: "Test Generator"
---

Playwright comes with the ability to generate tests out of the box and is a great way to quickly get started with testing. It will open two windows, a browser window where you interact with the website you wish to test and the Playwright Inspector window where you can record your tests, copy the tests, clear your tests as well as change the language of your tests.

**You will learn**

- How to record your user actions and generate tests with Codegen

## Generating Tests from VS Code
* langs: js

Record new tests by clicking on the "record tests" button in the testing sidebar. This will open a browser window where you can navigate to a URL and perform actions on the page which will be recorded to a new test file in VS Code.

<video width="100%" height="100%" controls muted>
  <source src="https://user-images.githubusercontent.com/13063165/197721416-e525dd60-51a6-4740-ad8b-0f56f4d20045.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

Check out the [VS Code Extension](./getting-started-vscode.md) doc to learn more.

## Generating Tests from the CLI

```bash js
npx playwright codegen demo.playwright.dev/todomvc
```

```bash java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen demo.playwright.dev/todomvc"
```

```bash python
playwright codegen demo.playwright.dev/todomvc
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen demo.playwright.dev/todomvc
```

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will attempt to generate resilient text-based selectors.

<img width="1350" alt="Codegen generating code for tests for playwright.dev website" src="https://user-images.githubusercontent.com/13063165/197802581-70d04c3a-7e90-4bd2-a419-b3e294f946f3.png" />


When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor. 

Use the **clear** button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.

To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).
## What's Next

- [See a trace of your tests](./trace-viewer-intro.md)
