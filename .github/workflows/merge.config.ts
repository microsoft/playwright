export default {
  testDir: '../../tests',
  reporter: [[require.resolve('../../tests/config/ghaMarkdownReporter.ts')], ['html']]
};