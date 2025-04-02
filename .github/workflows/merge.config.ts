export default {
  testDir: '../../tests',
  reporter: [[require.resolve('../../packages/playwright-dashboard/lib/ghaMarkdownReporter')], ['html']]
};