# Component testing with Playwright and Vue3

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin) + [Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).

## Project Setup

```sh
npm i
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Test project

Run tests from your VS Code, or execute

```sh
npm run test
```

## How to add component tests using Playwright

- npm init vue@latest was used to create a default project.

    ```sh
    npm init vue@latest
    ```

- Install Playwright Text w/ component testing as dev dependencies.

    ```sh
    npm i --save-dev @playwright/test @playwright/experimental-ct-vue
    ```

- `tests.js` file was added that registers all the components to be tested.

    ```js
    import register from '@playwright/experimental-ct-vue/register'

    import Counter from './src/components/Counter.vue'
    import DocumentationIcon from './src/components/icons/IconDocumentation.vue'
    import HelloWorld from './src/components/HelloWorld.vue'
    import NamedSlots from './src/components/NamedSlots.vue'
    import TheWelcome from './src/components/TheWelcome.vue'
    import WelcomeItem from './src/components/WelcomeItem.vue'

    register({
      Counter,
      DocumentationIcon,
      HelloWorld,
      NamedSlots,
      TheWelcome,
      WelcomeItem,
    })
    ```
- `tests.html` file was added that defines theming for the components and references `tests.js`.
    ```html
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>@import '/src/assets/base.css';</style>
    </head>
    <body>
      <div id="app"></div>
      <script type="module" src="/tests.js"></script>
    </body>
    </html>
    ```
- `playwright.config.ts` was added that executes `npm run dev` before running tests if it is not already running.
    ```js
    import { PlaywrightTestConfig, devices } from '@playwright/test';

    const config: PlaywrightTestConfig = {
      testDir: 'src',
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 2 : 0,
      reporter: process.env.CI ? [
        ['html', { open: 'never' }],
      ] : [
        ['html', { open: 'on-failure' }]
      ],
      webServer: {
        url: 'http://localhost:3000/tests.html',
        command: 'npm run dev',
        reuseExistingServer: !process.env.CI,
      },
      use: {
        baseURL: 'http://localhost:3000/tests.html',
        trace: 'on-first-retry',
      },
      projects: [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
      ],
    };

    export default config;
    ```
- A bunch of `.spec.ts` and `.spec.tsx` files were added to `src` that demonstrate Vue3 component testing with and without the use of JSX syntax.
