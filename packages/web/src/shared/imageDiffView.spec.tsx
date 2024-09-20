/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { test, expect } from '@playwright/experimental-ct-react';
import type { ImageDiff } from './imageDiffView';
import { ImageDiffView } from './imageDiffView';

test.use({ viewport: { width: 1000, height: 800 } });

const expectedPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAQAAAD9CzEMAAACMElEQVRYw+1XT0tCQRD/9Qci0Cw7mp1C6BMYnt5niMhPEEFCh07evNk54XnuGkhFehA/QxHkqYMEFWXpscMTipri7fqeu+vbfY+EoBkQ3Zn5zTo7MzsL/NNfoClkUUQNN3jCJ/ETfavRSpYkkSmFQzz8wMr4gaSp8OBJ2HCU4Iwd0kqGgd9GPxCccZ+0jWgWVW1wxlWy0qR51I3hv7lOllq7b4SC/+aGzr+QBadjEKgAykvzJGXwr/Lj4JfRk5hUSLKIa00HPUJRki0xeMWSWxVXmi5sddXKymqTyxdwquXAUVV3WREeLx3gTcNFWQY/jXtB8QIzgt4qTvAR4OCe0ATKCmrnmFMEM0Pp2BvrIisaFUdUjgKKZgYWSjjDLR5J+x13lATHuHSti6JBzQP+gq2QHXjfRaiJojbPgYqbmGFow0VpiyIW0/VIF9QKLzeBWA2MHmwCu8QJQV++Ps/joHQQH4HpuO0uobUeVztgIcr4Vnf4we9orWfUIWKHbEVyYKkPmaVpIVKICuo0ZYXWjHTITXWhsVYxkIDpUoKsla1i2Oz2QjvYG9fshu36GbFQ8DGyHNOuvRdOKZSDUtCFM7wyHeSM4XN8e7bOpd9F2gg+TRYal753bGkbuEjzMg0YW/yDV1czUDm+e43Byz86OnRwsYDMKXlmkYbeAOwffrtU/nGpXpwkXfPhVza+D9AiMAtrtOMYfVr0q8Wr1nh8n8ADZCJPqAk8AifyjP2n36cvkA6/Wln9MokAAAAASUVORK5CYII=';
const actualPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAQAAAD9CzEMAAACcElEQVRYw+2XQU9TQRDHfxAiYoFE8IaHhhjjN3hw4+SJk0npGU+iCQYv1kQjIQInj6+foh4amhjvEi8EI3yAIk24lBgoBkmqqYfuLvt23763r8QmJszc3sz+/29nZ3Zm4Vr+BxkgoESFPY7o0OGIPSqUCBi4OvgUmzToOLTBJlO9g08QcuEEl3pByEQv8Ascp4JLPWYhG/gQ5QjAGVWWmSXPTUa5xxxLfDJ2V2bIF36ELW3hASuMxfqNsiSOvatbjPj9fU0tabPOjUTvHG/4pfxrPrvQg7PqteNA20c5zbkYiWubgmZbZJcTzvjKGneMZP6m1hST4CdpGvmhU0zzXX0/5VFk5V21iyaTboJQwa7STqH4Y1AE6ixCd9XKxHsHFFIpTo1AvVal56juDeFQZxi8KNaMjJJh2oiDH+RQmFfUtzSKXQPjifh+yGBcsnWNrUhZJVO0DIxxFeTAJigJU9X4nkRxYqF8FL4lm6AiTMuW5bMzaXcs36fCs2IT7AvTjHNvNsVjy3dO+O3bBLLE8jF9oemsblPuq3KzRB7PrZhl8/z2pBhTteAkyMUunI+0HzdFzk0gwzDtvKde8SU2o3TJu0MkD3k28bYtpFDMuA/ZnaZZKJ6707SkuhJXoKi6Cy1QDT7XM8U4LfdVEXfZSXnAMz6wTZ1zzqmzrVWGTvEi6bK7vK4bWqO/zUtF7FJJMcxB0nWtN5y3omje89Nr8OpSrKc1HL1lBjzUGosPxWWTDX2a/o8M4FFNbPrm2NKLFrMMXtk1dfCKjo5ZteY3AEeHX3/1HH7jxne/4HiP7314gPTlCdWHR2BfnrHX8u/lL/ENCdIFFeD3AAAAAElFTkSuQmCC';

const actualAttachment = { name: 'screenshot-actual.png', path: actualPng, contentType: 'image/png', };
const expectedAttachment = { name: 'screenshot-expected.png', path: expectedPng, contentType: 'image/png', };
const diffAttachment = { name: 'screenshot-diff.png', path: expectedPng, contentType: 'image/png', };

const imageDiff: ImageDiff = {
  name: 'log in',
  actual: { attachment: actualAttachment },
  expected: { attachment: expectedAttachment, title: 'Expected' },
  diff: { attachment: diffAttachment },
};

test('should render links', async ({ mount }) => {
  const component = await mount(<ImageDiffView key='image-diff' diff={imageDiff}></ImageDiffView>);
  await expect(component.locator('a')).toHaveText([
    'screenshot-diff.png',
    'screenshot-actual.png',
    'screenshot-expected.png',
  ]);
});

test('should show diff by default', async ({ mount }) => {
  const component = await mount(<ImageDiffView key='image-diff' diff={imageDiff}></ImageDiffView>);

  const image = component.locator('img');
  const box = await image.boundingBox();
  expect(box).toEqual(expect.objectContaining({ width: 48, height: 48 }));
});
