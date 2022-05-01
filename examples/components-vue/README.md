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

- Install Playwright Test with component testing as dev dependencies.

    ```sh
    npm i --save-dev @playwright/test @playwright/experimental-ct-vue
    ```

- [playwright/index.html](playwright/index.html) file was added that defines theming for the components through importing [playwright/index.js](playwright/index.js) .

- [playwright.config.ts](playwright.config.ts) was added that executes `npm run dev` before running tests if it is not already running.
  
- A bunch of `.spec.ts` and `.spec.tsx` files were added to `src` that demonstrate Vue3 component testing with and without the use of JSX syntax.
