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

export const expect: typeof import('../../bundles/expect/node_modules/expect/build').expect = require('./expectBundleImpl').expect;
export const EXPECTED_COLOR: typeof import('../../bundles/expect/node_modules/jest-matcher-utils/build').EXPECTED_COLOR = require('./expectBundleImpl').EXPECTED_COLOR;
export const INVERTED_COLOR: typeof import('../../bundles/expect/node_modules/jest-matcher-utils/build').INVERTED_COLOR = require('./expectBundleImpl').INVERTED_COLOR;
export const RECEIVED_COLOR: typeof import('../../bundles/expect/node_modules/jest-matcher-utils/build').RECEIVED_COLOR = require('./expectBundleImpl').RECEIVED_COLOR;
export const printReceived: typeof import('../../bundles/expect/node_modules/jest-matcher-utils/build').printReceived = require('./expectBundleImpl').printReceived;
