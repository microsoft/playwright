/**
 * Copyright Microsoft Corporation. All rights reserved.
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
const path = require('path');
const rm = require('rimraf').sync;

const browserName = process.env.BROWSER || 'chromium';

module.exports = async function setup() {
	const OUTPUT_DIR = path.join(__dirname, '..', 'output-' + browserName);
	if (fs.existsSync(OUTPUT_DIR))
  	rm(OUTPUT_DIR);
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
};
