const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
    },
    tests: {
      entry: 'src/tests.js',
      template: 'src/tests.html',
      filename: 'tests.html',
    },
  }
})
