---
id: codegen-intro
title: "Test Generator"
---

Playwright comes with the ability to generate tests out of the box and is a great way to quickly get started with testing. It will open two windows, a browser window where you interact with the website you wish to test and the Playwright Inspector window where you can record your tests, copy the tests, clear your tests as well as change the language of your tests.

<video width="100%" height="100%" controls muted >
  <source src="https://user-images.githubusercontent.com/13063165/197979804-c4fa3347-8fab-4526-a728-c1b2fbd079b4.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

**You will learn**

- [How to generate tests with Codegen](/codegen.md#running-codegen)


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
* langs: js

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

<img width="1365" alt="Recording a test" src="https://user-images.githubusercontent.com/13063165/212754505-b98e80fd-6dda-48f7-860b-b32b4fabee33.png" />

When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor.

Use the **clear** button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.

To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).
### Recording a test
* langs: java

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

<img width="1365" alt="Recording a test" src="https://user-images.githubusercontent.com/13063165/212754804-0d9f9d52-0a48-45c8-970d-e672d4a91221.png" />

When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor.

Use the **clear** button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.

To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).
### Recording a test
* langs: python

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

<img width="1365" alt="Recording a test" src="https://user-images.githubusercontent.com/13063165/212751993-b7da2c40-a7cc-4b13-9a91-40ee837042a1.png" />

When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor.

Use the **clear** button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.

To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).
### Recording a test
* langs: csharp

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

<img width="1365" alt="Screenshot 2023-01-16 at 20 42 26" src="https://user-images.githubusercontent.com/13063165/212754994-fa637d81-b81d-44b8-bcd7-5dc218034f0a.png" />

When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor.

Use the **clear** button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.

To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).

### Generating locators
* langs: js

You can generate [locators](/locators.md) with the test generator. Press the record button to stop the recording and the `'Pick Locator`' button will appear. Click on the Pick Locator button and then hover over elements in the browser window to see the locator highlighted underneath each element. To choose a locator click on the element you would like to locate and the code for that locator will appear in the field next to the Pick Locator button. You can then edit the locator in this field to fine tune it or use the copy button to copy it and paste it into your code.

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753129-55fbcf69-0be3-422e-888a-f52060c7aa6b.png" />

### Generating locators
* langs: java

You can generate [locators](/locators.md) with the test generator. Press the record button to stop the recording and the `'Pick Locator`' button will appear. Click on the Pick Locator button and then hover over elements in the browser window to see the locator highlighted underneath each element. To choose a locator click on the element you would like to locate and the code for that locator will appear in the field next to the Pick Locator button. You can then edit the locator in this field to fine tune it or use the copy button to copy it and paste it into your code.

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753446-456484a8-8c37-4104-8db5-4525b74c8cf1.png" />

### Generating locators
* langs: python

You can generate [locators](/locators.md) with the test generator. Press the record button to stop the recording and the `'Pick Locator`' button will appear. Click on the Pick Locator button and then hover over elements in the browser window to see the locator highlighted underneath each element. To choose a locator click on the element you would like to locate and the code for that locator will appear in the field next to the Pick Locator button. You can then edit the locator in this field to fine tune it or use the copy button to copy it and paste it into your code.

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753605-861d66a4-fc1c-4559-b821-cb1f39059337.png" />

### Generating locators
* langs: csharp

You can generate [locators](/locators.md) with the test generator. Press the record button to stop the recording and the `'Pick Locator`' button will appear. Click on the Pick Locator button and then hover over elements in the browser window to see the locator highlighted underneath each element. To choose a locator click on the element you would like to locate and the code for that locator will appear in the field next to the Pick Locator button. You can then edit the locator in this field to fine tune it or use the copy button to copy it and paste it into your code.

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753728-49d35a7c-c05a-4298-bf66-89930d2cb578.png" />

## What's Next

- [See a trace of your tests](./trace-viewer-intro.md)
