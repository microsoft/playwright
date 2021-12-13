/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

class BundleJsPlugin {
  constructor() {
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('bundle-js-plugin', compilation => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync('bundle-js-plugin', (htmlPluginData, callback) => {
        callback(null, this.processTags(compilation, htmlPluginData));
      });
    });
  };

  processTags(compilation, pluginData) {
    const headTags = pluginData.headTags.map(tag => this.processTag(compilation, tag));
    const bodyTags = pluginData.bodyTags.map(tag => this.processTag(compilation, tag));
    return { ...pluginData, headTags, bodyTags };
  }

  processTag(compilation, tag) {
    if (tag.tagName !== 'script' || !tag.attributes.src)
      return tag;

    const asset = getAssetByName(compilation.assets, tag.attributes.src);
    const innerHTML = asset.source().replace(/(<)(\/script>)/g, '\\x3C$2');
    return {
      tagName: 'script',
      attributes: {
        type: 'text/javascript'
      },
      closeTag: true,
      innerHTML,
    };
  }
}

function getAssetByName (assets, assetName) {
  for (var key in assets) {
    if (assets.hasOwnProperty(key)) {
      var processedKey = path.posix.relative('', key);
      if (processedKey === assetName) {
        return assets[key];
      }
    }
  }
}

module.exports = BundleJsPlugin;
