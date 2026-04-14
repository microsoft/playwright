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

import React from 'react';

import type { Page } from 'playwright-core';

export const Screencast: React.FC<{ page: Page }> = ({ page }) => {
  const [frameSrc, setFrameSrc] = React.useState('');

  React.useEffect(() => {
    const forceComposite = setTimeout(async () => {
      const session = await page.context().newCDPSession(page);
      await session.send('Page.captureScreenshot', { optimizeForSpeed: true, quality: 0, format: 'jpeg' });
      await session.detach();
    }, 100);
    void page.screencast.start({ onFrame: ({ data }) => {
      clearTimeout(forceComposite);
      setFrameSrc('data:image/jpeg;base64,' + data);
    } });
    return () => {
      void page.screencast.stop().catch(() => {}); // if there are other screencast consumers at the same time, this will stop them too
    };
  }, [page]);

  if (!frameSrc)
    return <div className='screencast-placeholder'>Connecting...</div>;

  return <img className='screencast-frame' alt='screencast' src={frameSrc} />;
};
