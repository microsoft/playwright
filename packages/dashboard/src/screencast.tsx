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

import type { DashboardClientChannel } from './dashboardClient';
import type { DashboardChannelEvents } from './dashboardChannel';

export const Screencast: React.FC<{ client: DashboardClientChannel; browser: string }> = ({ client, browser }) => {
  const [frameSrc, setFrameSrc] = React.useState('');

  React.useEffect(() => {
    const listener = (params: DashboardChannelEvents['frame']) => {
      if (params.target.browser !== browser)
        return;
      setFrameSrc('data:image/jpeg;base64,' + params.data);
    };
    client.on('frame', listener);
    return () => client.off('frame', listener);
  }, [client, browser]);

  if (!frameSrc)
    return <div className='screencast-placeholder'>Connecting...</div>;

  return <img className='screencast-frame' alt='screencast' src={frameSrc} />;
};
