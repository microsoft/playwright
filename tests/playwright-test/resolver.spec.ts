/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';

test('should respect path resolver', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11656' });

  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        projects: [{name: 'foo'}],
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": ".",
        "paths": {
          "util/*": ["./foo/bar/util/*"],
          "util2/*": ["./foo/bar/util/*"],
          "util3": ["./does-not-exist", "./foo/bar/util/b"],
        },
      },
    }`,
    'a.test.ts': `
      import { foo } from 'util/b';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'b.test.ts': `
      import { foo } from 'util2/b';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'c.test.ts': `
      import { foo } from 'util3';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      export const foo: string = 'foo';
    `,
    'helper.ts': `
      export { foo } from 'util3';
    `,
    'dir/tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": ".",
        "paths": {
          "parent-util/*": ["../foo/bar/util/*"],
        },
      },
    }`,
    'dir/inner.spec.ts': `
      // This import should pick up <root>/dir/tsconfig
      import { foo } from 'parent-util/b';
      // This import should pick up <root>/tsconfig through the helper
      import { foo as foo2 } from '../helper';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
        expect(testInfo.project.name).toBe(foo2);
      });
    `,
  });

  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);
  expect(result.output).not.toContain(`Could not`);
});

test('should respect baseurl', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        projects: [{name: 'foo'}],
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": "./foo",
        "paths": {
          "util/*": ["./bar/util/*"],
          "util2": ["./bar/util/b"],
        },
      },
    }`,
    'a.test.ts': `
      import { foo } from 'util/b';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'b.test.ts': `
      import { foo } from 'util2';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      export const foo: string = 'foo';
    `,
  });

  expect(result.passed).toBe(2);
  expect(result.exitCode).toBe(0);
});

test('should respect baseurl w/o paths', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'foo/bar/util/b.ts': `
      export const foo = 42;
    `,
    'dir2/tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": "..",
      },
    }`,
    'dir2/inner.spec.ts': `
      // This import should pick up ../foo/bar/util/b due to baseUrl.
      import { foo } from 'foo/bar/util/b';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe(42);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`Could not`);
});

test('should fallback to *:* when baseurl and paths are specified', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'foo/bar/util/b.ts': `
      export const foo = 42;
    `,
    'shared/x.ts': `
      export const x = 43;
    `,
    'dir2/tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": "..",
        "paths": {
          "shared/*": ["./shared/*"],
        },
      },
    }`,
    'dir2/inner.spec.ts': `
      // This import should pick up ../foo/bar/util/b due to baseUrl and *:* fallback.
      import { foo } from 'foo/bar/util/b';
      // This import should pick up ../shared/x due to baseUrl+paths.
      import { x } from 'shared/x';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe(42);
        expect(x).toBe(43);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`Could not`);
});

test('should use the location of the tsconfig as the paths root when no baseUrl is specified', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'foo/bar/util/b.ts': `
      export const foo = 42;
    `,
    'dir2/tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "paths": {"foo/*": ["../foo/*"]},
      },
    }`,
    'dir2/inner.spec.ts': `
      // This import should pick up ../foo/bar/util/b due to paths.
      import { foo } from 'foo/bar/util/b';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe(42);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`Could not`);
});

test('should respect complex path resolver', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        projects: [{name: 'foo'}],
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": ".",
        "paths": {
          "prefix-*": ["./prefix-*/bar"],
          "prefix-*-suffix": ["./prefix-*-suffix/bar"],
          "*-suffix": ["./*-suffix/bar"],
          "no-star": ["./no-star-foo"],
          "longest-*": ["./this-is-not-the-longest-prefix"],
          "longest-pre*": ["./this-is-the-longest-prefix"],
          "*bar": ["./*bar"],
          "*[bar]": ["*foo"],
        },
      },
    }`,
    'a.spec.ts': `
      import { foo } from 'prefix-matchedstar';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'prefix-matchedstar/bar/index.ts': `
      export const foo: string = 'foo';
    `,
    'b.spec.ts': `
      import { foo } from 'prefix-matchedstar-suffix';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'prefix-matchedstar-suffix/bar.ts': `
      export const foo: string = 'foo';
    `,
    'c.spec.ts': `
      import { foo } from 'matchedstar-suffix';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'matchedstar-suffix/bar.ts': `
      export const foo: string = 'foo';
    `,
    'd.spec.ts': `
      import { foo } from 'no-star';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    './no-star-foo.ts': `
      export const foo: string = 'foo';
    `,
    'e.spec.ts': `
      import { foo } from 'longest-prefix';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    './this-is-the-longest-prefix.ts': `
      // this module should be resolved as it matches by a longer prefix
      export const foo: string = 'foo';
    `,
    './this-is-not-the-longest-prefix.ts': `
      // This module should't be resolved as it matches by a shorter prefix
      export const bar: string = 'bar';
    `,
    'f.spec.ts': `
      import { foo } from 'barfoobar';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'barfoobar.ts': `
      export const foo: string = 'foo';
    `,
    'g.spec.ts': `
      import { foo } from 'foo/[bar]';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/foo.ts': `
      export const foo: string = 'foo';
    `,
  });

  expect(result.passed).toBe(7);
  expect(result.exitCode).toBe(0);
  expect(result.output).not.toContain(`Could not`);
});

test('should not use baseurl for relative imports', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15891' });
  const result = await runInlineTest({
    'frontend/tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": "src",
      },
    }`,
    'frontend/playwright/utils.ts': `
      export const foo = 42;
    `,
    'frontend/playwright/tests/forms_cms_standard.spec.ts': `
      // This relative import should not use baseUrl
      import { foo } from '../utils';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe(42);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`Could not`);
});

test('should not use baseurl for relative imports when dir with same name exists', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15891' });

  const result = await runInlineTest({
    'frontend/tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": "src",
      },
    }`,
    'frontend/src/utils/foo.js': `
      export const foo = -1;
    `,
    'frontend/src/index.js': `
      export const index = -1;
    `,
    'frontend/src/.bar.js': `
      export const bar = 42;
    `,
    'frontend/playwright/tests/utils.ts': `
      export const foo = 42;
    `,
    'frontend/playwright/tests/index.js': `
      export const index = 42;
    `,
    'frontend/playwright/tests/forms_cms_standard.spec.ts': `
      // These relative imports should not use baseUrl
      import { foo } from './utils';
      import { index } from '.';

      // This absolute import should use baseUrl
      import { bar } from '.bar';

      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe(42);
        expect(index).toBe(42);
        expect(bar).toBe(42);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`Could not`);
  expect(result.output).not.toContain(`Cannot`);
});

test('should respect path resolver for JS files when allowJs', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `export default { projects: [{name: 'foo'}], };`,
    'tsconfig.json': `{
      "compilerOptions": {
        "allowJs": true,
        "baseUrl": ".",
        "paths": {
          "util/*": ["./foo/bar/util/*"],
        },
      },
    }`,
    'a.test.js': `
      const { foo } = require('util/b');
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      module.exports = { foo: 'foo' };
    `,
  });

  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should not respect path resolver for JS files w/o allowJS', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `export default { projects: [{name: 'foo'}], };`,
    'tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "util/*": ["./foo/bar/util/*"],
        },
      },
    }`,
    'a.test.js': `
      const { foo } = require('util/b');
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      module.exports = { foo: 'foo' };
    `,
  });

  expect(result.output).toContain('Cannot find module \'util/b\'');
  expect(result.exitCode).toBe(1);
});

test('should respect path resolver for JS and TS files from jsconfig.json', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `export default { projects: [{name: 'foo'}], };`,
    'jsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "util/*": ["./foo/bar/util/*"],
        },
      },
    }`,
    'a.test.js': `
      const { foo } = require('util/b');
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'b.test.ts': `
      import { foo } from 'util/b';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      module.exports = { foo: 'foo' };
    `,
  });

  expect(result.passed).toBe(2);
  expect(result.exitCode).toBe(0);
});

test('should support extends in tsconfig.json', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tsconfig.json': `{
      "extends": ["./tsconfig.base1.json", "./tsconfig.base2.json"],
    }`,
    'tsconfig.base1.json': `{
      "extends": "./tsconfig.base.json",
      "compilerOptions": {
        "allowJs": true,
      },
    }`,
    'tsconfig.base2.json': `{
      "compilerOptions": {
        "baseUrl": "dir",
      },
    }`,
    'tsconfig.base.json': `{
      "compilerOptions": {
        "paths": {
          "util/*": ["./foo/bar/util/*"],
        },
      },
    }`,
    'a.test.js': `
      // This js file is affected by tsconfig because allowJs is inherited.
      // Next line resolve to the final baseUrl ("dir") + relative path mapping ("./foo/bar/util/*").
      const { foo } = require('util/file');
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe('foo');
      });
    `,
    'dir/foo/bar/util/file.ts': `
      module.exports = { foo: 'foo' };
    `,
  });

  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve paths relative to the originating config when extending and no baseUrl', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tsconfig.json': `{
      "extends": ["./dir/tsconfig.base.json"],
    }`,
    'dir/tsconfig.base.json': `{
      "compilerOptions": {
        "paths": {
          "~/*": ["../mapped/*"],
        },
      },
    }`,
    'a.test.ts': `
      // This resolves relative to the base tsconfig that defined path mapping,
      // because there is no baseUrl in the final tsconfig.
      const { foo } = require('~/file');
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe('foo');
      });
    `,
    'mapped/file.ts': `
      module.exports = { foo: 'foo' };
    `,
  });

  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should import packages with non-index main script through path resolver', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'app/pkg/main.ts': `
      export const foo = 42;
    `,
    'app/pkg/package.json': `
      { "main": "main.ts" }
    `,
    'package.json': `
      { "name": "example-project" }
    `,
    'playwright.config.ts': `
      export default {};
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "app/*": ["app/*"],
        },
      },
    }`,
    'example.spec.ts': `
      import { foo } from 'app/pkg';
      import { test, expect } from '@playwright/test';
      test('test', ({}) => {
        console.log('foo=' + foo);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`find module`);
  expect(result.output).toContain(`foo=42`);
});

test('should not honor `package.json#main` field in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'app/pkg/main.ts': `
      export const foo = 42;
    `,
    'app/pkg/package.json': `
      { "main": "main.ts" }
    `,
    'package.json': `
      { "name": "example-project", "type": "module" }
    `,
    'playwright.config.ts': `
      export default {};
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "app/*": ["app/*"],
        },
      },
    }`,
    'example.spec.ts': `
      import { foo } from 'app/pkg';
      import { test, expect } from '@playwright/test';
      test('test', ({}) => {
        console.log('foo=' + foo);
      });
    `,
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Cannot find package 'app'`);
});


test('does not honor `exports` field after type mapping', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'app/pkg/main.ts': `
      export const filename = 'main.ts';
    `,
    'app/pkg/index.js': `
      export const filename = 'index.js';
    `,
    'app/pkg/package.json': JSON.stringify({
      exports: { '.': { require: './main.ts' } }
    }),
    'package.json': JSON.stringify({
      name: 'example-project'
    }),
    'playwright.config.ts': `
      export default {};
    `,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: {
          'app/*': ['app/*'],
        },
      }
    }),
    'example.spec.ts': `
      import { filename } from 'app/pkg';
      import { test, expect } from '@playwright/test';
      test('test', ({}) => {
        console.log('filename=' + filename);
      });
    `,
  });

  expect(result.output).toContain('filename=index.js');
});

test('should respect tsconfig project references', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29256' });

  const result = await runInlineTest({
    'playwright.config.ts': `export default { projects: [{name: 'foo'}], };`,
    'tsconfig.json': `{
      "files": [],
      "references": [
        { "path": "./tsconfig.app.json" },
        { "path": "./tsconfig.test.json" }
      ]
    }`,
    'tsconfig.test.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "util/*": ["./foo/bar/util/*"],
        },
      },
    }`,
    'foo/bar/util/b.ts': `
      export const foo: string = 'foo';
    `,
    'a.test.ts': `
      import { foo } from 'util/b';
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        expect(foo).toBe('foo');
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect --tsconfig option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { foo } from '~/foo';
      export default {
        testDir: './tests' + foo,
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "~/*": ["./does-not-exist/*"],
        },
      },
    }`,
    'tsconfig.special.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "~/*": ["./mapped-from-root/*"],
        },
      },
    }`,
    'mapped-from-root/foo.ts': `
      export const foo = 42;
    `,
    'tests42/tsconfig.json': `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "~/*": ["../should-be-ignored/*"],
        },
      },
    }`,
    'tests42/a.test.ts': `
      import { foo } from '~/foo';
      import { test, expect } from '@playwright/test';
      test('test', ({}) => {
        expect(foo).toBe(42);
      });
    `,
    'should-be-ignored/foo.ts': `
      export const foo = 43;
    `,
  }, { tsconfig: 'tsconfig.special.json' });

  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
  expect(result.output).not.toContain(`Could not`);
});


test('should resolve index.js in CJS after path mapping', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31811' });

  const result = await runInlineTest({
    '@acme/lib/index.js': `
      exports.greet = () => console.log('hello playwright');
    `,
    '@acme/lib/index.d.ts': `
      export const greet: () => void;
    `,
    'tests/hello.test.ts': `
      import { greet } from '@acme/lib';
      import { test } from '@playwright/test';
      test('hello', async ({}) => {
        greet();
      });
    `,
    'tests/tsconfig.json': JSON.stringify({
      compilerOptions: {
        'paths': {
          '@acme/*': ['../@acme/*'],
        }
      }
    })
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should not resolve index.js in ESM after path mapping', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31811' });

  const result = await runInlineTest({
    '@acme/lib/index.js': `
      export const greet = () => console.log('hello playwright');
    `,
    '@acme/lib/index.d.ts': `
      export const greet: () => void;
    `,
    'tests/hello.test.ts': `
      import { greet } from '@acme/lib';
      import { test } from '@playwright/test';
      test('hello', async ({}) => {
        greet();
      });
    `,
    'tests/tsconfig.json': JSON.stringify({
      compilerOptions: {
        'paths': {
          '@acme/*': ['../@acme/*'],
        }
      }
    }),
    'package.json': JSON.stringify({ type: 'module' }),
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Cannot find package '@acme/lib'`);
});
