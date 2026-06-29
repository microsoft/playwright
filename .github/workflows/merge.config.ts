import path from 'path';

export default {
  testDir: '../../tests',
  reporter: [
    // Writes the markdown summary to report.md at the repo root.
    [require.resolve('../../tests/config/markdownReporter'), { outputFile: path.resolve(__dirname, '../../report.md') }],
    ['html'],
  ],
};
