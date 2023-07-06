# Playwright trace-viewer package

  

### Setup playwright locally:

1. After cloning the repo, run `npm ci` to install all of the dependencies listed in the main package.json.

2. Run `npm build` to build packages and generate types.

3. The build will be found under `packages/playwright-core/lib`. We will not use this build.

### Trace-viewer NPM package

**1. Export components:**
 - I created a `index.ts` inside the `packages/trace-viewer/ui` and
   exported all of the components within the same directory.
   
   Then I created a `index.ts` inside the `packages/trace-viewer/src`
   that exports everything from the `packages/trace-viewer/ui`. This
   file is going to be our entry point.
   
**2. Configure Vite:**
 - I installed `vite-plugin-dts` in the main directory as a dev   
   dependency to generate deceleration files for the exported   
   components. 
 - Then imported `dts` function from it and added it to the    
   `plugins` property.
 - I added a `lib` object inside the build property. This is used to
   bundle the library. The entry point is the `index.ts` exporting all  
   the components.
 - In formats I added `es` and `ejs` to add support for both es   
   module and common js imports.
 - filename will map the rendered files with the proper extension    cjs
   or es.
 - RollupOptions: In external I added `react` and `react-dom` which   
   will not be bundled by us For the output option I added the `globals`
   attribute to map the external libraries with their variables names.
 - I removed the `outDir` so that the build of the trace-viewer   
   package is generated as a `dist` file in `packages/trace-viewer/`
 - run `npm run build` script inside `packages/trace-viewer` to build
   the components library.
   
**3. Configure package.json**
 - In `packages/trace-viewer/package.json` I changed `private` to `false`
 - I added the `main` entry point from `dist` which is the common js index.
 - I added the `module` entry point from `dist` which is the es module index.
 - I added the `types` entry point from `dist/trace-viewer/src/index.d.ts`
 - In the main `package.json` at the root directory, I added `react` and `react-dom` as peer dependencies because they are not bundled with our package and need to be installed the app consuming the package.

**4. Linking:** 
Before linking the npm package we will need to link the react module used in the nextjs app where we are going to test the npm package. If we don't, the package will see two react packages in the test app causing react hooks to throw undefined errors. 
 - To do this run `npm link <path_to_test_app>/node_modules/react`
 - Then run `npm link` inside `packages/trace-viewer`

**5. Publishing**

 - inside `packages/trace-viewer` run `npm publish --access=public`

### Fix keys issues
	
 - in `playwright/packages/web/src/components/tabbedPane.tsx` I added a `key` prop to `TabbedPaneTab` component. Also I had to add a `key` prop to the spacer tab, although it's rendered one time. I generated a random id for it.
 - in `playwright/packages/trace-viewer/src/ui` I added a `key` prop for `TabbedPaneTab` component.

### Setup storybook
**1.  Installed storybook packages as dev dependencies:**
 - storybook
 -  @storybook/react
 - @storybook/addon-actions: used to display data received by event handlers.
 - @storybook/addon-essentials: collection of addons for storybook
 - @storybook/addon-links: sed to create links that navigate between stories
 - @storybook/builder-vite: used to run stories with vite.
 - @storybook/react-vite: used to specify the framework in storybook configs.

**2. Setup storybook configs**
 - I created a `.storybook/main.js` in the main directory to add storybook configs.
 - In configs, I added the path to stories and storybook addons.
 -  I specified `framework` with `@storybook/react-vite` npm package.
 - I added `core` and specified the builder to `@storybook/builder-vite`.
 - Then added an async function `viteFinal` to override Vite configuration. Here I added the `path` to the vite config of `trace-viewer`. 
 - Defined the `process.env.NODE_DEGUB` to be false. That because Vite does not polyfill `process` for the browser so it won't be defined there.
 - Then in the resolve attribute I mapped the alias with their absolute paths so rollup can find them when bundling components. 

**3. Add scripts**
 - I added `build-storybook` to the main package.json to build storybook and `storybook` script to run storybook.
 - I added `storybook-static` generated folder when building to `.gitignore`

**4. Create Stories**

 - I created a `stories` folder in the main directory where we are going to have our stories to test components.
 - In `stories/index.stories.tsx` I created a simple story where I test the `timeline` component imported from the `trace-viewer` package.