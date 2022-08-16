import { test, expect } from '@playwright/experimental-ct-react'
import { serverFixtures } from '../../../../tests/config/serverFixtures';
import Fetch from './components/Fetch';
import DelayedData from './components/DelayedData';
import Button from './components/Button';
import DefaultChildren from './components/DefaultChildren';
import MultipleChildren from './components/MultipleChildren';
import MultiRoot from './components/MultiRoot';

test.use({ viewport: { width: 500, height: 500 } });

test('props should work', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(component).toContainText('Submit');
});

test('callback should work', async ({ mount }) => {
  const messages: string[] = []
  const component = await mount(<Button title="Submit" onClick={data => {
    messages.push(data)
  }}></Button>)
  await component.click()
  expect(messages).toEqual(['hello'])
})

test('default slot should work', async ({ mount }) => {
  const component = await mount(<DefaultChildren>
    Main Content
  </DefaultChildren>)
  await expect(component).toContainText('Main Content')
})

test('multiple children should work', async ({ mount }) => {
  const component = await mount(<DefaultChildren>
    <div id="one">One</div>
    <div id="two">Two</div>
  </DefaultChildren>)
  await expect(component.locator('#one')).toContainText('One')
  await expect(component.locator('#two')).toContainText('Two')
})

test('named children should work', async ({ mount }) => {
  const component = await mount(<MultipleChildren>
    <div>Header</div>
    <div>Main Content</div>
    <div>Footer</div>
  </MultipleChildren>);
  await expect(component).toContainText('Header')
  await expect(component).toContainText('Main Content')
  await expect(component).toContainText('Footer')
})

test('children should callback', async ({ mount }) => {
  let clickFired = false;
  const component = await mount(<DefaultChildren>
    <span onClick={() => clickFired = true}>Main Content</span>
  </DefaultChildren>);
  await component.locator('text=Main Content').click();
  expect(clickFired).toBeTruthy();
})

test('should run hooks', async ({ page, mount }) => {
  const messages: string[] = [];
  page.on('console', m => messages.push(m.text()));
  await mount(<Button title="Submit" />, {
    hooksConfig: {
      route: 'A'
    }
  });
  expect(messages).toEqual(['Before mount: {\"route\":\"A\"}', 'After mount']);
});

test('should unmount', async ({ page, mount }) => {
  const component = await mount(<Button title="Submit" />)
  await expect(page.locator('#root')).toContainText('Submit')
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});

test('unmount a multi root component should work', async ({ mount, page }) => {
  const component = await mount(<MultiRoot />)
  await expect(page.locator('#root')).toContainText('root 1')
  await expect(page.locator('#root')).toContainText('root 2')
  await component.unmount()
  await expect(page.locator('#root')).not.toContainText('root 1')
  await expect(page.locator('#root')).not.toContainText('root 2')
})

test('toHaveText works on delayed data', async ({ mount }) => {
  const component = await mount(<DelayedData data='complete' />);
  await expect(component).toHaveText('complete');
});

const testWithServer = test.extend(serverFixtures);
testWithServer('components routing should go through context', async ({ mount, context, server }) => {
  server.setRoute('/hello', (req, res) => {
    res.write('served via server');
    res.end();
  });

  let markRouted: (url: string) => void;
  const routedViaContext = new Promise(res => markRouted = res);
  await context.route('**/hello', async (route, request) => {
    markRouted(`${request.method()} ${request.url()}`);
    await route.fulfill({
      body: 'intercepted',
    });
  });

  const whoServedTheRequest = Promise.race([
    server.waitForRequest('/hello').then((req) => `served via server: ${req.method} ${req.url}`),
    routedViaContext.then(req => `served via context: ${req}`),
  ]);

  const component = await mount(<Fetch url={server.PREFIX + '/hello'} />);
  await expect.soft(whoServedTheRequest).resolves.toMatch(/served via context: GET.*\/hello.*/i);
  await expect.soft(component).toHaveText('intercepted');
});
