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

const { registerFixture } = require('../../');
const fs = require('fs');
const path = require('path');

registerFixture('postProcess', async ({}, runTest, info) => {
	await runTest('');
	const { config, result } = info;
	fs.writeFileSync(path.join(config.outputDir, 'test-error-visible-in-fixture.txt'), JSON.stringify(result.error, undefined, 2));
});

it('ensure fixture handles test error', async ({ postProcess }) => {
  expect(true).toBe(false);
});
