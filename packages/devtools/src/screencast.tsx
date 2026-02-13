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

import type { DevToolsClientChannel } from './devtoolsClient';

export const Screencast: React.FC<{ channel: DevToolsClientChannel }> = ({ channel }) => {
  const [frameSrc, setFrameSrc] = React.useState('');

  React.useEffect(() => {
    const listener = (params: { data: string }) => {
      setFrameSrc('data:image/jpeg;base64,' + params.data);
    };
    channel.on('frame', listener);
    return () => channel.off('frame', listener);
  }, [channel]);

  if (!frameSrc)
    return <div className='screencast-placeholder'>Connecting...</div>;

  return <img className='screencast-frame' alt='screencast' src={frameSrc} />;
};
