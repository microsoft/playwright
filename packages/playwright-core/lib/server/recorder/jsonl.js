"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JsonlLanguageGenerator = void 0;
var _locatorGenerators = require("../../utils/isomorphic/locatorGenerators");
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class JsonlLanguageGenerator {
  constructor() {
    this.id = 'jsonl';
    this.groupName = '';
    this.name = 'JSONL';
    this.highlighter = 'javascript';
  }
  generateAction(actionInContext) {
    const locator = actionInContext.action.selector ? JSON.parse((0, _locatorGenerators.asLocator)('jsonl', actionInContext.action.selector)) : undefined;
    const entry = {
      ...actionInContext.action,
      pageAlias: actionInContext.frame.pageAlias,
      locator
    };
    return JSON.stringify(entry);
  }
  generateHeader(options) {
    return JSON.stringify(options);
  }
  generateFooter(saveStorage) {
    return '';
  }
}
exports.JsonlLanguageGenerator = JsonlLanguageGenerator;