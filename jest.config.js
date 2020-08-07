module.exports = /** @type {import('@jest/types').Config.InitialOptions} */ ({
  // all of our tests have a browser and a node process, so the default max workers is too many.
  maxWorkers: Math.ceil(require('os').cpus().length / 2),
  rootDir: './test',
  testEnvironment: './jest',
  testMatch:  ['**/?(*.)(jest|spec).[jt]s'],
  testRunner: 'jest-circus/runner',
  testTimeout: 10000,
  globalSetup: './jest/setup.js',
  globalTeardown: './jest/teardown.js',
  transform: {
    '^.+\\.ts$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          }
        }],
        ['@babel/preset-typescript']
      ],
    }],
  },
  reporters: [
    'default',
    './jest/reporter'
  ],
  slowTestThreshold: 30
});
