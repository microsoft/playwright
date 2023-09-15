---
id: codegen-intro
title: "Generating tests"
---

## Introduction

Playwright comes with the ability to generate tests out of the box and is a great way to quickly get started with testing. It will open two windows, a browser window where you interact with the website you wish to test and the Playwright Inspector window where you can record your tests, copy the tests, clear your tests as well as change the language of your tests.

**You will learn**

- [How to record a test](/codegen.md#recording-a-test)
- [How to generate locators](/codegen.md#generating-locators)

## Running Codegen

Use the `codegen` command to run the test generator followed by the URL of the website you want to generate tests for. The URL is optional and you can always run the command without it and then add the URL directly into the browser window instead.

```bash js
npx playwright codegen demo.playwright.dev/todomvc
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen demo.playwright.dev/todomvc"
```

```bash python
playwright codegen demo.playwright.dev/todomvc
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen demo.playwright.dev/todomvc
```

### Recording a test

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will look at the rendered page and figure out the recommended locator, prioritizing role, text and test id locators. If the generator identifies multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, therefore eliminating and reducing test(s) failing and flaking due to locators.

######
* langs: js

![Recording a test](https://github.com/microsoft/playwright/assets/13063165/9effe72a-3bfd-42e1-87f3-2e6b0a2b71f9)

######
* langs: java

![recording a test](https://github.com/microsoft/playwright/assets/13063165/26183fc4-a8a1-4d1c-9cdc-aca404a6eb9c)

######
* langs: python

![recording a test](https://github.com/microsoft/playwright/assets/13063165/57ed3f29-6436-4f2b-98ad-05de92d30075)

######
* langs: csharp

![recording a test](https://github.com/microsoft/playwright/assets/13063165/06bd474b-cdd1-4384-9de2-c745f296c78c)
######
* langs: js, java, python, csharp

When you have finished interacting with the page, press the `'record'` button to stop the recording and use the `'copy'` button to copy the generated code to your editor.

Use the `'clear'` button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.

To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).

### Generating locators

You can generate [locators](/locators.md) with the test generator.

* Press the `'Record'` button to stop the recording and the `'Pick Locator'` button will appear.
* Click on the `'Pick Locator'` button and then hover over elements in the browser window to see the locator highlighted underneath each element.
* To choose a locator click on the element you would like to locate and the code for that locator will appear in the locator playground next to the Pick Locator button.
* You can then edit the locator in the locator playground to fine tune it and see the matching element highlighted in the browser window. 
* Use the copy button to copy the locator and paste it into your code.

######
* langs: js

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/4e46e1dd-dac2-4372-b643-00f896bb7e5f)

######
* langs: java

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/6200e6d1-e420-422c-9b62-831ec3fd43ea)

######
* langs: python

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/49ad6214-dfec-4aae-b86c-0fdf05278293)

######
* langs: csharp

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/d8d47fbc-38d6-4a6b-a9ab-4c40380f480b)

### Emulation

You can also generate tests using emulation so as to generate a test for a specific viewport, device, color scheme, as well as emulate the geolocation, language or timezone. The test generator can also generate a test while preserving authenticated state. Check out the [Test Generator](./codegen.md#emulation) guide to learn more.

## What's Next

- [See a trace of your tests](./trace-viewer-intro.md)
