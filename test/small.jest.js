require('./environments/server');

it('should work', async() => {
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => 1+ 1)).toBe(2);
});