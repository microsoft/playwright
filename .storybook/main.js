
import path from 'path';

module.exports = {
  stories: ['../stories/*.stories.tsx'],
  addons: [
    '@storybook/addon-actions',
    '@storybook/addon-links',
    '@storybook/addon-essentials',
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    builder: '@storybook/builder-vite'
  },
  async viteFinal(config, { configType }) {
    return {
      ...config,
      viteConfig: require('../packages/trace-viewer/vite.config'),
      define: {
        'process.env.NODE_DEBUG': false,
      },
      resolve: {
        alias: [
          {
            find: "@web",
            replacement: path.join(__dirname, "../packages/web/src"),
          },
          {
            find: "@injected",
            replacement: path.join(__dirname, "../packages/playwright-core/src/server/injected"),
          },
          {
            find: "@isomorphic",
            replacement: path.join(__dirname, "../packages/playwright-core/src/utils/isomorphic"),
          },
          {
            find: "@protocol",
            replacement: path.join(__dirname, "../packages/protocol/src"),
          },
          {
            find: "@testIsomorphic",
            replacement: path.join(__dirname, "../packages/playwright-test/src/isomorphic"),
          },
          {
            find: "@trace",
            replacement: path.join(__dirname, "../packages/trace/src"),
          },

        ]
      }
    }
  }
};