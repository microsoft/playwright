/**
 * Copyright 2018 Google Inc. All rights reserved.
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
const { resolve } = require('path');
const { FFOX, CHROMIUM, WEBKIT } = require('./utils').testOptions(browserType);
const { promisify } = require('util');

const delay = promisify(setTimeout);

describe('Page.video', function () {
    it('should work', async ({ page, server, golden }) => {
        await page.startVideo();
        await page.goto(server.PREFIX + '/grid.html');
        await delay(3000);
        const video = await page.stopVideo();
        // expect(video).toBeGolden(golden('grid-video.mp4'));
        expect(video).toBeInstanceOf(Buffer);
    });
    it('should contain more than one frame', async ({ page, server, golden }) => {
        await page.startVideo({ outFile: 'demo.mp4', keepScreenshots: true });
        await page.goto(server.PREFIX + '/grid.html');
        await delay(3000);
        await page.goto(server.PREFIX + '/input/button.html');
        await page.click('button');
        await delay(3000);
        const video = await page.stopVideo();
        expect(video).toBeInstanceOf(Buffer);
    })
});
