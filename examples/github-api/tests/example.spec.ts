import { test, expect } from '@playwright/test';

test('should get post #1', async ({ request }) => {
  const post = await request.get(`https://jsonplaceholder.typicode.com/posts/1`);
  expect(post.ok()).toBeTruthy();

  await request.post(`https://jsonplaceholder.typicode.com/posts/1`);
});
