export default {
  testDir: '../../tests',
  reporter: [[require.resolve('../../packages/playwright/lib/reporters/markdown')], ['html']]
};