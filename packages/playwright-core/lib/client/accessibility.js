"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Accessibility = void 0;
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function axNodeFromProtocol(axNode) {
  const result = {
    ...axNode,
    value: axNode.valueNumber !== undefined ? axNode.valueNumber : axNode.valueString,
    checked: axNode.checked === 'checked' ? true : axNode.checked === 'unchecked' ? false : axNode.checked,
    pressed: axNode.pressed === 'pressed' ? true : axNode.pressed === 'released' ? false : axNode.pressed,
    children: axNode.children ? axNode.children.map(axNodeFromProtocol) : undefined
  };
  delete result.valueNumber;
  delete result.valueString;
  return result;
}
class Accessibility {
  constructor(channel) {
    this._channel = void 0;
    this._channel = channel;
  }
  async snapshot(options = {}) {
    const root = options.root ? options.root._elementChannel : undefined;
    const result = await this._channel.accessibilitySnapshot({
      interestingOnly: options.interestingOnly,
      root
    });
    return result.rootAXNode ? axNodeFromProtocol(result.rootAXNode) : null;
  }
}
exports.Accessibility = Accessibility;