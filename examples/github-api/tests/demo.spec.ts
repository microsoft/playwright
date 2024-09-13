import { test, expect } from "@playwright/test";

test('should get posts', async ({ request }) => {
    const posts = await request.get(`https://jsonplaceholder.typicode.com/posts/1`);
    expect(posts.ok()).toBeTruthy();
    expect(await posts.text()).toHaveLength(10)
});