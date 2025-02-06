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

## async method: TestStepInfo.attach
* since: v1.51

Attach a value or a file from disk to the current test step. Some reporters show test step attachments. Either [`option: path`] or [`option: body`] must be specified, but not both. Calling this method will attribute the attachment to the step, as opposed to [`method: TestInfo.attach`] which stores all attachments at the test level.

For example, you can attach a screenshot to the test step:

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  await test.step('check page rendering', async step => {
    const screenshot = await page.screenshot();
    await step.attach('screenshot', { body: screenshot, contentType: 'image/png' });
  });
});
```

Or you can attach files returned by your APIs:

```js
import { test, expect } from '@playwright/test';
import { download } from './my-custom-helpers';

test('basic test', async ({}) => {
  await test.step('check download behavior', async step => {
    const tmpPath = await download('a');
    await step.attach('downloaded', { path: tmpPath });
  });
});
```

:::note
[`method: TestStepInfo.attach`] automatically takes care of copying attached files to a
location that is accessible to reporters. You can safely remove the attachment
after awaiting the attach call.
:::

### param: TestStepInfo.attach.name
* since: v1.51
- `name` <[string]>

Attachment name. The name will also be sanitized and used as the prefix of file name
when saving to disk.

### option: TestStepInfo.attach.body
* since: v1.51
- `body` <[string]|[Buffer]>

Attachment body. Mutually exclusive with [`option: path`].

### option: TestStepInfo.attach.contentType
* since: v1.51
- `contentType` <[string]>

Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`. If omitted, content type is inferred based on the [`option: path`], or defaults to `text/plain` for [string] attachments and `application/octet-stream` for [Buffer] attachments.

### option: TestStepInfo.attach.path
* since: v1.51
- `path` <[string]>

Path on the filesystem to the attached file. Mutually exclusive with [`option: body`].

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
