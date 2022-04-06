# class: GlobalInfo
* langs: js

`GlobalInfo` contains information on the overall test run. The information spans projects and tests. Some reporters show global info.

You can write to GlobalInfo via your Global Setup hook, and read from it in a [Custom Reporter](../test-reporters.md):

```js js-flavor=js
// global-setup.js
module.exports = async (config, info) => {
  await info.attach('agent.config.txt', { path: './agent.config.txt' });
};
```

```js js-flavor=ts
// global-setup.ts
import { chromium, FullConfig, GlobalInfo } from '@playwright/test';

async function globalSetup(config: FullConfig, info: GlobalInfo) {
  await info.attach('agent.config.txt', { path: './agent.config.txt' });
}

export default globalSetup;
```

Access the attachments from the Root Suite in the Reporter:

```js js-flavor=js
// my-awesome-reporter.js
// @ts-check

/** @implements {import('@playwright/test/reporter').Reporter} */
class MyReporter {
  onBegin(config, suite) {
    this._suite = suite;
  }

  onEnd(result) {
    console.log(`Finished the run with ${this._suite.attachments.length} global attachments!`);
  }
}

module.exports = MyReporter;
```

```js js-flavor=ts
// my-awesome-reporter.ts
import { Reporter } from '@playwright/test/reporter';

class MyReporter implements Reporter {
  private _suite;

  onBegin(config, suite) {
    this._suite = suite;
  }

  onEnd(result) {
    console.log(`Finished the run with ${this._suite.attachments.length} global attachments!`);
  }
}
export default MyReporter;
```

Finally, specify `globalSetup` in the configuration file and `reporter`:

```js js-flavor=js
// playwright.config.js
// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  globalSetup: require.resolve('./global-setup'),
  reporter: require.resolve('./my-awesome-reporter'),
};
module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve('./global-setup'),
  reporter: require.resolve('./my-awesome-reporter'),
};
export default config;
```

See [`TestInfo`](./class-testinfo.md) for related attachment functionality scoped to the test-level.

## method: GlobalInfo.attachments
- type: <[Array]<[Object]>>
  - `name` <[string]> Attachment name.
  - `contentType` <[string]> Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`.
  - `path` <[void]|[string]> Optional path on the filesystem to the attached file.
  - `body` <[void]|[Buffer]> Optional attachment body used instead of a file.

The list of files or buffers attached to the overall test run. Some reporters show global attachments.

To add an attachment, use [`method: GlobalInfo.attach`]. See [`property: TestInfo.attachments`] if you are looking for test-scoped attachments.

## method: GlobalInfo.attach

Attach a value or a file from disk to the overall test run. Some reporters show global attachments. Either [`option: path`] or [`option: body`] must be specified, but not both.

See [`method: TestInfo.attach`] if you are looking for test-scoped attachments.

:::note
[`method: GlobalInfo.attach`] automatically takes care of copying attached files to a
location that is accessible to reporters. You can safely remove the attachment
after awaiting the attach call.
:::

### param: GlobalInfo.attach.name
- `name` <[string]> Attachment name.

### option: GlobalInfo.attach.body
- `body` <[string]|[Buffer]> Attachment body. Mutually exclusive with [`option: path`].

### option: GlobalInfo.attach.contentType
- `contentType` <[void]|[string]> Optional content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`. If omitted, content type is inferred based on the [`option: path`], or defaults to `text/plain` for [string] attachments and `application/octet-stream` for [Buffer] attachments.

### option: GlobalInfo.attach.path
- `path` <[string]> Path on the filesystem to the attached file. Mutually exclusive with [`option: body`].
