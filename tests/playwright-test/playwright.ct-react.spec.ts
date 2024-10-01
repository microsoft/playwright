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

import { test, expect, playwrightCtConfigText } from './playwright-test-fixtures';

test('should work with TSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,
    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with JSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.jsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with JSX in JS', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.js': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with JSX in JS and in JSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.js': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.jsx': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });

      test('pass list', async ({ mount }) => {
        const component = await mount(<List></List>);
        await expect(component).toHaveText('List');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});


test('should work with stray TSX import', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,

    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.tsx': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with stray JSX import', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.jsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.jsx': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with stray JS import', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.js': `
      export const Button = () => <button>Button</button>;
    `,

    'src/list.js': `
      export const List = () => <ul><li>List</li></ul>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { List } from './list';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with JSX in variable', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/button.jsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      const button = <Button></Button>;

      test('pass button', async ({ mount }) => {
        const component = await mount(button);
        await expect(component).toHaveText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should pass "key" attribute from JSX in variable', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': `
    `,

    'src/container.jsx': `
      import { useState } from 'react';
      export function Container({ children }) {
        const [index, setIndex] = useState(0);
        return (
          <div onClick={() => setIndex((index + 1) % children.length)}>
            {children[index]}
          </div>
        );
      }
    `,

    'src/button.jsx': `
      import { useState } from 'react';
      export function Button({ value }) {
        const [state, setState] = useState(value);
        return <button onClick={() => setState(state + 1)}>{state}</button>;
      }
    `,

    'src/index.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';
      import { Container } from './container';

      test('key should tear down and recreate component', async ({ mount }) => {
        const component = await mount(
          <Container>
            <Button key='a' value={1} />
            <Button key='b' value={10} />
          </Container>
        );
        const button = component.getByRole('button');
        await expect(button).toHaveText("1");
        await button.click();
        await expect(button).toHaveText("10");
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should return root locator for fragments', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,

    'src/button.jsx': `
      export const Button = () => <><h1>Header</h1><button>Button</button></>;
    `,

    'src/button.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button';

      test('pass button', async ({ mount }) => {
        const component = await mount(<Button></Button>);
        await expect(component).toContainText('Header');
        await expect(component).toContainText('Button');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect default property values', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/label.tsx': `
      export const Label = ({ checked }) => <div>type:{typeof checked} value:{String(checked)}</div>;
    `,

    'src/label.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Label } from './label';

      test('boolean shorthand', async ({ mount }) => {
        const component = await mount(<Label checked></Label>);
        await expect(component).toHaveText('type:boolean value:true');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should bundle public folder', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,
    'public/logo.svg': `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50"/>
      </svg>`,
    'src/image.tsx': `
      export const Image = () => <img src='/logo.svg' className="App-logo" alt="logo" />;
    `,
    'src/image.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Image } from './image';

      test('pass', async ({ mount, page }) => {
        const urls = [];
        const [response] = await Promise.all([
          page.waitForResponse('**/*.svg'),
          mount(<Image></Image>)
        ]);
        const data = await response.body();
        await expect(data.toString()).toContain('</svg>');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with property expressions in JSX', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': `
    `,
    'src/button1.tsx': `
      const Button = () => <button>Button 1</button>;
      export const components1 = { Button };
    `,
    'src/button2.tsx': `
      const Button = () => <button>Button 2</button>;
      export default { Button };
    `,
    'src/button.test.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { components1 } from './button1';
      import components2 from './button2';

      test('pass 1', async ({ mount }) => {
        const component = await mount(<components1.Button />);
        await expect(component).toHaveText('Button 1');
      });

      test('pass 2', async ({ mount }) => {
        const component = await mount(<components2.Button />);
        await expect(component).toHaveText('Button 2');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should handle the baseUrl config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/experimental-ct-react';
      export default defineConfig({ use: { baseURL: 'http://127.0.0.1:8080' } });
    `,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,

    'src/component.jsx': `
      export const Component = () => <></>;
    `,

    'src/component.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Component } from './component';

      test('pass component', async ({ page, mount }) => {
        const component = await mount(<Component />);
        await expect(page).toHaveURL('http://127.0.0.1:8080/');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should handle the vite host config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/experimental-ct-react';
      export default defineConfig({ use: { ctViteConfig: { preview: { host: '127.0.0.1' } } } });
    `,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,

    'src/component.jsx': `
      export const Component = () => <></>;
    `,

    'src/component.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Component } from './component';

      test('pass component', async ({ page, mount }) => {
        const component = await mount(<Component />);
        const host = await page.evaluate(() => window.location.hostname);
        await expect(host).toBe('127.0.0.1');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should prioritize the vite host config over the baseUrl config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/experimental-ct-react';
      export default defineConfig({
        use: {
          baseURL: 'http://localhost:8080',
          ctViteConfig: { preview: { host: '127.0.0.1' } }
        },
      });
    `,
    'playwright/index.html': `<script type="module" src="./index.js"></script>`,
    'playwright/index.js': ``,

    'src/component.jsx': `
      export const Component = () => <></>;
    `,

    'src/component.test.jsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Component } from './component';

      test('pass component', async ({ page, mount }) => {
        const component = await mount(<Component />);
        await expect(page).toHaveURL('http://127.0.0.1:8080/');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should normalize children', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/component.tsx': `
      import React from 'react';
      export const OneChild: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
        React.Children.only(children);
        return <>{children}</>;
      };
      export const OtherComponent: React.FC = () => <p>othercomponent</p>;   
    `,

    'src/component.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { OneChild, OtherComponent } from './component';

      test("can pass an HTML element to OneChild", async ({ mount }) => {
        const component = await mount(<OneChild><p>child</p></OneChild>);
        await expect(component).toHaveText("child");
      });
      
      test("can pass another component to OneChild", async ({ mount }) => {
        const component = await mount(<OneChild><OtherComponent /></OneChild>);
        await expect(component).toHaveText("othercomponent");
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should allow props children', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/component.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';

      test("renders children from props object", async ({ mount, page }) => {
        const props = { children: 'test' };
        await mount(<button {...props} />);
        await expect(page.getByText('test')).toBeVisible();
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should allow import from shared file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': playwrightCtConfigText,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,
    'src/component.tsx': `
      export const Component = (props: { content: string }) => {
        return <div>{props.content}</div>
      };
    `,
    'src/component.shared.tsx': `
      export const componentMock = { content: 'This is a content.' };
    `,
    'src/component.render.tsx': `
      import {Component} from './component';
      import {componentMock} from './component.shared';
      export const ComponentTest = () => {
        return <Component content={componentMock.content} />;
      };
    `,
    'src/component.spec.tsx': `
      import { expect, test } from '@playwright/experimental-ct-react';
      import { ComponentTest } from './component.render';
      import { componentMock } from './component.shared';
      test('component renders', async ({ mount }) => {
        const component = await mount(<ComponentTest />);
        await expect(component).toContainText(componentMock.content)
      })`
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
