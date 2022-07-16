import { test, expect } from '@playwright/experimental-ct-react';
import App from './App';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<App></App>);
  await expect(component).toContainText('Hello Vite + React!');
});

test('should configure app', async ({ page, mount }) => {
  const messages: string[] = [];
  page.on('console', m => messages.push(m.text()));
  await mount(<App></App>, {
    hooksConfig: {
      route: 'A'
    }
  });
  expect(messages).toEqual(['Before mount: {\"route\":\"A\"}', 'After mount']);
});
