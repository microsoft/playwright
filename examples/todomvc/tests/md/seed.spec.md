## Seed

- fixtures: ../fixtures

### seed test

- Navigate to 'https://demo.playwright.dev/todomvc'
  ```ts
  await page.goto('https://demo.playwright.dev/todomvc');
  ```

- expect: page title contains "TodoMVC"

- expect: The input field 'What needs to be done?' is visible
