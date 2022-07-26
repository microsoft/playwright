//@ts-check

import '../src/index.css';

import { beforeMount, afterMount, wrapComponent } from '@playwright/experimental-ct-react/hooks';

beforeMount(async ({ hooksConfig }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);
});

afterMount(async ({}) => {
  console.log(`After mount`);
});

wrapComponent(async ({ hooksConfig, render }) => {
  if (hooksConfig?.wrapperId) {
    return <div id={hooksConfig.wrapperId}>
      {render()}
    </div>;
  } else {
    return render();
  }
});
