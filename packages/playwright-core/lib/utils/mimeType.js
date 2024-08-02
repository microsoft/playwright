"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isJsonMimeType = isJsonMimeType;
exports.isTextualMimeType = isTextualMimeType;
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

function isJsonMimeType(mimeType) {
  return !!mimeType.match(/^(application\/json|application\/.*?\+json|text\/(x-)?json)(;\s*charset=.*)?$/);
}
function isTextualMimeType(mimeType) {
  return !!mimeType.match(/^(text\/.*?|application\/(json|(x-)?javascript|xml.*?|ecmascript|graphql|x-www-form-urlencoded)|image\/svg(\+xml)?|application\/.*?(\+json|\+xml))(;\s*charset=.*)?$/);
}