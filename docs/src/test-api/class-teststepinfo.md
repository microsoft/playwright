# class: TestStepInfo
* since: v1.51
* langs: js

`TestStepInfo` contains information about currently running test step. It is passed as an argument to the step function. `TestStepInfo` provides utilities to control test step execution.

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page, browserName }, TestStepInfo) => {
  await test.step('check some behavior', async step => {
    await step.skip(browserName === 'webkit', 'The feature is not available in WebKit');
    // ... rest of the step code
    await page.check('input');
  });
});
```

## method: TestStepInfo.skip#1
* since: v1.51

Unconditionally skip the currently running step. Test step is immediately aborted. This is similar to [`method: Test.step.skip`].

## method: TestStepInfo.skip#2
* since: v1.51

Conditionally skips the currently running step with an optional description. This is similar to [`method: Test.step.skip`].

### param: TestStepInfo.skip#2.condition
* since: v1.51
- `condition` <[boolean]>

A skip condition. Test step is skipped when the condition is `true`.

### param: TestStepInfo.skip#2.description
* since: v1.51
- `description` ?<[string]>

Optional description that will be reflected in a test report.
