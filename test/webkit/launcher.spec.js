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
const fs = require('fs');
const os = require('os');
const path = require('path');
const {helper} = require('../../lib/helper');
const rmAsync = helper.promisify(require('rimraf'));
const mkdtempAsync = helper.promisify(fs.mkdtemp);
const TMP_FOLDER = path.join(os.tmpdir(), 'pptr_tmp_folder-');
const utils = require('../utils');

module.exports.describe = function ({ testRunner, expect, playwright }) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('WKPlaywright', function() {
    describe('Playwright.launch', function() {
      it('should return the default arguments', async() => {
        expect(playwright.defaultArgs().length).toBe(0);
      });
    });
  });
};
