---
id: test-snapshots
title: "Snapshots"
---

Playwright Test includes the ability to produce and compare snapshots. For that, use `expect(value).toMatchSnapshot()`. Test runner auto-detects the content type, and includes built-in matchers for text, png and jpeg images, and arbitrary binary data.

```js
// example.spec.ts
import { test } from 'playwright/test';

test('my test', async () => {
  const image = await produceSomePNG();
  test.expect(image).toMatchSnapshot('optional-snapshot-name.png');
});
```

Snapshots are stored under `__snapshots__` directory by default, and can be specified in the [configuration object](#configuration-object).
